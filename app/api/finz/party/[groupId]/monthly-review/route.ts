import { NextResponse } from "next/server";
import {
  buildFinzMonthlyReview,
  type FinzReviewKind,
  type FinzRoomMessage,
} from "@/lib/common/services/finz-monthly-review";
import { getChatTail, appendAnswerMessage } from "@/lib/server/finz-chat-store";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import {
  appendFinzMonthlyReview,
  listFinzMonthlyReviews,
  refreshFinzMonthlyReviewTtl,
} from "@/lib/server/finz-monthly-review-store";
import { yahooFinzPriceProvider } from "@/lib/server/finz-price-provider";

export const runtime = "nodejs";

type Body = {
  memberId?: unknown;
  kind?: unknown;
  requestedAt?: unknown;
};

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const kind = parseReviewKind(body.kind) ?? "manual-interim";
  const requestedAt =
    typeof body.requestedAt === "string" ? body.requestedAt : new Date().toISOString();

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (memberId && !group.members.some((member) => member.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  const [tail, previousReviews] = await Promise.all([
    getChatTail(groupId, -1, true),
    listFinzMonthlyReviews(groupId),
  ]);
  const review = await buildFinzMonthlyReview({
    roomId: groupId,
    kind,
    requestedAt,
    messages: toReviewMessages(groupId, tail.messages),
    previousReviews,
    priceProvider: yahooFinzPriceProvider,
  });

  await appendFinzMonthlyReview(review);
  await refreshFinzMonthlyReviewTtl(groupId);
  const appended = await appendAnswerMessage(groupId, review.summaryText);
  if (appended.status !== "ok" || !appended.message) {
    return NextResponse.json({ status: "error", reason: "append-failed" }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", review, message: appended.message });
}

function parseReviewKind(value: unknown): FinzReviewKind | null {
  return value === "scheduled-monthly" || value === "manual-interim" ? value : null;
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
