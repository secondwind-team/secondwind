import { FINZ_GROUP_TTL_SECONDS, getClient } from "./finz-group-store";
import type { FinzReviewRecord } from "@/lib/common/services/finz-monthly-review";

export const FINZ_MONTHLY_REVIEW_TTL_SECONDS = 365 * 24 * 60 * 60;

function reviewKey(groupId: string): string {
  return `sw:finz:monthly-review:${groupId}`;
}

export async function listFinzMonthlyReviews(groupId: string): Promise<FinzReviewRecord[]> {
  const redis = getClient();
  if (!redis) return [];
  const raw = await redis.lrange<unknown[]>(reviewKey(groupId), 0, -1);
  return raw
    .map(parseJsonSafe)
    .filter((value): value is FinzReviewRecord => isFinzReviewRecord(value));
}

export async function appendFinzMonthlyReview(review: FinzReviewRecord): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.rpush(reviewKey(review.roomId), JSON.stringify(review));
  await redis.expire(reviewKey(review.roomId), FINZ_MONTHLY_REVIEW_TTL_SECONDS);
}

// 방 TTL 이 만료될 때 월간 리뷰만 오래 남는 것은 의도적이다. 다만 방이 살아 있는 동안에는
// 최근 활동 기준으로 group/chat TTL 이 갱신되므로 리뷰 조회용 key 도 충분히 길게 보관한다.
export async function refreshFinzMonthlyReviewTtl(groupId: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.expire(reviewKey(groupId), Math.max(FINZ_MONTHLY_REVIEW_TTL_SECONDS, FINZ_GROUP_TTL_SECONDS));
}

export function isFinzReviewRecord(value: unknown): value is FinzReviewRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FinzReviewRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.roomId === "string" &&
    (record.kind === "scheduled-monthly" || record.kind === "manual-interim") &&
    typeof record.periodEnd === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatesMonthlyBaseline === "boolean" &&
    Array.isArray(record.mentions) &&
    Array.isArray(record.priceSnapshots) &&
    typeof record.summaryText === "string"
  );
}

function parseJsonSafe(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
