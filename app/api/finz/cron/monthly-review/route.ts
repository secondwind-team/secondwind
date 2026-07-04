import { NextResponse } from "next/server";
import { getChatTail, appendAnswerMessage } from "@/lib/server/finz-chat-store";
import { getFinzGroup, listAllFinzRoomIds } from "@/lib/server/finz-group-store";
import {
  appendFinzMonthlyReview,
  listFinzMonthlyReviews,
} from "@/lib/server/finz-monthly-review-store";
import { buildFinzMonthlyReview, type FinzRoomMessage } from "@/lib/common/services/finz-monthly-review";
import { yahooFinzPriceProvider } from "@/lib/server/finz-price-provider";

export const runtime = "nodejs";

// Vercel cron 이 매일 UTC 03:00(KST 12:00)에 호출한다. 라우트 내부에서 한국시간 말일만 실행.
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ status: "error", reason: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isKstMonthEnd(now)) {
    return NextResponse.json({
      status: "ok",
      skipped: true,
      reason: "not-kst-month-end",
      checkedAt: now.toISOString(),
    });
  }

  const roomIds = await listAllFinzRoomIds();
  const results = [];
  for (const roomId of roomIds) {
    const group = await getFinzGroup(roomId);
    if (!group) {
      results.push({ roomId, status: "skipped", reason: "room-not-found" });
      continue;
    }
    const reviews = await listFinzMonthlyReviews(roomId);
    if (hasScheduledReviewForKstMonth(reviews, now)) {
      results.push({ roomId, status: "skipped", reason: "already-reviewed-this-month" });
      continue;
    }
    const tail = await getChatTail(roomId, -1, true);
    const review = await buildFinzMonthlyReview({
      roomId,
      kind: "scheduled-monthly",
      requestedAt: now.toISOString(),
      messages: toReviewMessages(roomId, tail.messages),
      previousReviews: reviews,
      priceProvider: yahooFinzPriceProvider,
    });
    await appendFinzMonthlyReview(review);
    await appendAnswerMessage(roomId, review.summaryText);
    results.push({ roomId, status: "ok", reviewId: review.id });
  }

  return NextResponse.json({ status: "ok", checkedAt: now.toISOString(), results });
}

function authorizeCron(req: Request): boolean {
  const secret = process.env.FINZ_CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function toReviewMessages(groupId: string, messages: Awaited<ReturnType<typeof getChatTail>>["messages"]): FinzRoomMessage[] {
  return messages.flatMap((message): FinzRoomMessage[] => {
    if (message.deletedAt || message.role !== "member") return [];
    if (message.kind !== "text" && message.kind !== "position") return [];
    const text =
      message.kind === "text"
        ? message.text
        : `${message.payload.stance}${message.payload.note ? ` ${message.payload.note}` : ""}`;
    return [{
      id: message.id,
      roomId: groupId,
      memberId: message.authorId,
      memberName: message.authorName,
      text,
      createdAt: message.createdAt,
    }];
  });
}

function isKstMonthEnd(date: Date): boolean {
  const parts = getKstParts(date);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return parts.day === lastDay;
}

function hasScheduledReviewForKstMonth(
  reviews: Array<{ kind: string; createdAt: string; updatesMonthlyBaseline: boolean }>,
  date: Date,
): boolean {
  const target = getKstParts(date);
  return reviews.some((review) => {
    if (review.kind !== "scheduled-monthly" || !review.updatesMonthlyBaseline) return false;
    const created = new Date(review.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const parts = getKstParts(created);
    return parts.year === target.year && parts.month === target.month;
  });
}

function getKstParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
  };
}
