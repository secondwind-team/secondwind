import {
  buildFinzMonthlyReview,
  hasScheduledReviewForKstMonth,
  kstYearMonth,
  type FinzReviewKind,
  type FinzReviewRecord,
  type FinzRoomMessage,
} from "@/lib/common/services/finz-monthly-review";
import { appendAnswerMessage, getChatTail } from "@/lib/server/finz-chat-store";
import { getFinzGroup } from "@/lib/server/finz-group-store";
import {
  appendFinzMonthlyReview,
  claimFinzMonthlyReviewRun,
  getFinzMonthlyReviews,
  releaseFinzMonthlyReviewRun,
  subscribeFinzMonthlyReview,
} from "@/lib/server/finz-monthly-review-store";
import { yahooFinzPriceProvider } from "@/lib/server/finz-price-provider";

export type FinzMonthlyReviewRunResult =
  | { status: "ok"; review: FinzReviewRecord }
  | { status: "not-found" | "busy" | "already-reviewed" | "append-failed" };

export async function runFinzMonthlyReview(input: {
  roomId: string;
  kind: FinzReviewKind;
  requestedAt?: string;
}): Promise<FinzMonthlyReviewRunResult> {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  const requestedDate = new Date(requestedAt);
  if (Number.isNaN(requestedDate.getTime())) throw new Error("invalid-requested-at");

  const group = await getFinzGroup(input.roomId);
  if (!group) return { status: "not-found" };

  const previousReviews = await getFinzMonthlyReviews(input.roomId);
  if (
    input.kind === "scheduled-monthly" &&
    hasScheduledReviewForKstMonth(previousReviews, requestedDate)
  ) {
    return { status: "already-reviewed" };
  }

  const runKey =
    input.kind === "scheduled-monthly"
      ? `scheduled:${kstYearMonth(requestedDate)}`
      : "manual-interim";
  const claimed = await claimFinzMonthlyReviewRun(input.roomId, runKey);
  if (!claimed) return { status: "busy" };

  try {
    const tail = await getChatTail(input.roomId, -1, true);
    const messages: FinzRoomMessage[] = tail.messages.flatMap((message) => {
      if (message.role !== "member" || message.kind !== "text" || message.deletedAt) return [];
      return [{
        id: message.id,
        roomId: input.roomId,
        memberId: message.authorId,
        memberName: message.authorName,
        text: message.text,
        createdAt: message.createdAt,
      }];
    });

    const review = await buildFinzMonthlyReview({
      roomId: input.roomId,
      kind: input.kind,
      requestedAt,
      messages,
      previousReviews,
      priceProvider: yahooFinzPriceProvider,
    });

    const appended = await appendAnswerMessage(input.roomId, review.summaryText);
    if (appended.status !== "ok" || !appended.message) return { status: "append-failed" };

    await appendFinzMonthlyReview(review);
    await subscribeFinzMonthlyReview(input.roomId);
    return { status: "ok", review };
  } finally {
    await releaseFinzMonthlyReviewRun(input.roomId, runKey);
  }
}
