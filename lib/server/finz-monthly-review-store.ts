import type { FinzReviewRecord } from "@/lib/common/services/finz-monthly-review";
import {
  FINZ_GROUP_TTL_SECONDS,
  getClient,
  isFinzGroupId,
  parseJsonSafe,
} from "@/lib/server/finz-group-store";

const REVIEW_TTL_SECONDS = 365 * 24 * 60 * 60;
const RUN_LOCK_TTL_SECONDS = 10 * 60;
const MAX_REVIEWS_PER_ROOM = 24;

function reviewsKey(roomId: string): string {
  return `sw:finz:monthly-review:${roomId}:reviews`;
}

function roomsKey(): string {
  return "sw:finz:monthly-review:rooms";
}

function runLockKey(roomId: string, runKey: string): string {
  return `sw:finz:monthly-review:${roomId}:run:${runKey}`;
}

export async function subscribeFinzMonthlyReview(roomId: string): Promise<void> {
  const redis = getClient();
  if (!redis || !isFinzGroupId(roomId)) return;
  await redis.sadd(roomsKey(), roomId);
}

export async function unsubscribeFinzMonthlyReview(roomId: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.srem(roomsKey(), roomId);
}

export async function listFinzMonthlyReviewRooms(limit = 50): Promise<string[]> {
  const redis = getClient();
  if (!redis) return [];
  const ids = (await redis.smembers(roomsKey())) as unknown[];
  return ids
    .filter((id): id is string => typeof id === "string" && isFinzGroupId(id))
    .slice(0, Math.max(0, limit));
}

export async function getFinzMonthlyReviews(roomId: string): Promise<FinzReviewRecord[]> {
  const redis = getClient();
  if (!redis || !isFinzGroupId(roomId)) return [];
  const raw = await redis.lrange(reviewsKey(roomId), 0, -1);
  return raw.flatMap((item): FinzReviewRecord[] => {
    const parsed = parseJsonSafe(item);
    return isFinzReviewRecord(parsed) ? [parsed] : [];
  });
}

export async function appendFinzMonthlyReview(review: FinzReviewRecord): Promise<void> {
  const redis = getClient();
  if (!redis || !isFinzGroupId(review.roomId)) return;
  const key = reviewsKey(review.roomId);
  await redis
    .pipeline()
    .rpush(key, JSON.stringify(review))
    .ltrim(key, -MAX_REVIEWS_PER_ROOM, -1)
    .expire(key, REVIEW_TTL_SECONDS)
    .sadd(roomsKey(), review.roomId)
    .expire(`sw:finz:group:${review.roomId}`, FINZ_GROUP_TTL_SECONDS)
    .exec();
}

export async function claimFinzMonthlyReviewRun(roomId: string, runKey: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  const result = await redis.set(runLockKey(roomId, runKey), "1", {
    nx: true,
    ex: RUN_LOCK_TTL_SECONDS,
  });
  return result === "OK";
}

export async function releaseFinzMonthlyReviewRun(roomId: string, runKey: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(runLockKey(roomId, runKey));
}

function isFinzReviewRecord(value: unknown): value is FinzReviewRecord {
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
