import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  build: vi.fn(),
  duplicate: vi.fn(),
  group: vi.fn(),
  getReviews: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  getTail: vi.fn(),
  appendAnswer: vi.fn(),
  appendReview: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("@/lib/common/services/finz-monthly-review", () => ({
  buildFinzMonthlyReview: h.build,
  hasScheduledReviewForKstMonth: h.duplicate,
  kstYearMonth: () => "2026-07",
}));

vi.mock("@/lib/server/finz-group-store", () => ({ getFinzGroup: h.group }));
vi.mock("@/lib/server/finz-chat-store", () => ({
  getChatTail: h.getTail,
  appendAnswerMessage: h.appendAnswer,
}));
vi.mock("@/lib/server/finz-monthly-review-store", () => ({
  getFinzMonthlyReviews: h.getReviews,
  claimFinzMonthlyReviewRun: h.claim,
  releaseFinzMonthlyReviewRun: h.release,
  appendFinzMonthlyReview: h.appendReview,
  subscribeFinzMonthlyReview: h.subscribe,
}));
vi.mock("@/lib/server/finz-price-provider", () => ({ yahooFinzPriceProvider: { provider: "yahoo" } }));

import { runFinzMonthlyReview } from "./finz-monthly-review-runner";

const requestedAt = "2026-07-31T03:00:00.000Z";
const review = { id: "review-1", summaryText: "summary" };

beforeEach(() => {
  vi.clearAllMocks();
  h.group.mockResolvedValue({ id: "abc123" });
  h.getReviews.mockResolvedValue([]);
  h.duplicate.mockReturnValue(false);
  h.claim.mockResolvedValue(true);
  h.getTail.mockResolvedValue({
    messages: [
      { id: "m1", role: "member", kind: "text", authorId: "a", authorName: "A", text: "NVDA", createdAt: requestedAt },
      { id: "m2", role: "finz", kind: "text", authorId: "finz", authorName: "FINZ", text: "bot", createdAt: requestedAt },
      { id: "m3", role: "member", kind: "text", authorId: "a", authorName: "A", text: "deleted", createdAt: requestedAt, deletedAt: requestedAt },
      { id: "m4", role: "member", kind: "position", authorId: "a", authorName: "A", createdAt: requestedAt },
    ],
  });
  h.build.mockResolvedValue(review);
  h.appendAnswer.mockResolvedValue({ status: "ok", message: { id: "answer" } });
});

it("잘못된 requestedAt을 즉시 거절", async () => {
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "manual-interim", requestedAt: "bad" })).rejects.toThrow("invalid-requested-at");
  expect(h.group).not.toHaveBeenCalled();
});

it("없는 방은 lock 이전에 not-found", async () => {
  h.group.mockResolvedValue(null);
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "manual-interim", requestedAt })).resolves.toEqual({ status: "not-found" });
  expect(h.claim).not.toHaveBeenCalled();
});

it("이미 처리한 정기 월과 lock 경합을 각각 dedupe", async () => {
  h.duplicate.mockReturnValueOnce(true);
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "scheduled-monthly", requestedAt })).resolves.toEqual({ status: "already-reviewed" });

  h.claim.mockResolvedValueOnce(false);
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "manual-interim", requestedAt })).resolves.toEqual({ status: "busy" });
  expect(h.release).not.toHaveBeenCalled();
});

it("멤버의 삭제되지 않은 text만 계산에 넘기고 성공 결과를 저장", async () => {
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "scheduled-monthly", requestedAt })).resolves.toEqual({ status: "ok", review });
  expect(h.claim).toHaveBeenCalledWith("abc123", "scheduled:2026-07");
  expect(h.build).toHaveBeenCalledWith(expect.objectContaining({
    roomId: "abc123",
    messages: [{ id: "m1", roomId: "abc123", memberId: "a", memberName: "A", text: "NVDA", createdAt: requestedAt }],
    priceProvider: { provider: "yahoo" },
  }));
  expect(h.appendReview).toHaveBeenCalledWith(review);
  expect(h.subscribe).toHaveBeenCalledWith("abc123");
  expect(h.release).toHaveBeenCalledWith("abc123", "scheduled:2026-07");
});

it("채팅 append 실패 시 review를 저장하지 않지만 lock은 해제", async () => {
  h.appendAnswer.mockResolvedValue({ status: "not-found" });
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "manual-interim", requestedAt })).resolves.toEqual({ status: "append-failed" });
  expect(h.appendReview).not.toHaveBeenCalled();
  expect(h.release).toHaveBeenCalledWith("abc123", "manual-interim");
});

it("계산 예외도 전파하면서 finally에서 lock을 해제", async () => {
  h.build.mockRejectedValue(new Error("price failure"));
  await expect(runFinzMonthlyReview({ roomId: "abc123", kind: "manual-interim", requestedAt })).rejects.toThrow("price failure");
  expect(h.release).toHaveBeenCalledWith("abc123", "manual-interim");
});
