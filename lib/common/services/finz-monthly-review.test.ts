import { describe, expect, it } from "vitest";
import {
  buildFinzMonthlyReview,
  extractFinzMentions,
  type FinzPriceProvider,
  type FinzReviewRecord,
  type FinzRoomMessage,
} from "./finz-monthly-review";

const priceProvider: FinzPriceProvider = {
  async getOpenPrice(asset, at) {
    const prices: Record<string, number> = {
      NVDA: at.startsWith("2026-07") ? 132.1 : 124.5,
      BTC: at.startsWith("2026-07") ? 64900 : 61200,
    };
    return {
      price: prices[asset.symbol] ?? 10,
      currency: "USD",
      observedAt: at,
      source: "test-open",
    };
  },

  async getFirstAvailableOpenPrice(asset, from) {
    const prices: Record<string, number> = {
      NVDA: 100,
      BTC: 50000,
    };
    return {
      price: prices[asset.symbol] ?? 10,
      currency: "USD",
      observedAt: from,
      source: "test-first-open",
    };
  },
};

const messages: FinzRoomMessage[] = [
  {
    id: "m1",
    roomId: "room-1",
    memberId: "u1",
    memberName: "태훈",
    text: "엔비디아는 AI 때문에 아직 좋다고 봐. NVDA 더 갈 듯",
    createdAt: "2026-06-10T03:00:00.000Z",
  },
  {
    id: "m2",
    roomId: "room-1",
    memberId: "u2",
    memberName: "지헌",
    text: "BTC는 조정 오면 살 것 같아",
    createdAt: "2026-06-18T03:00:00.000Z",
  },
  {
    id: "m3",
    roomId: "room-1",
    memberId: "u1",
    memberName: "태훈",
    text: "테슬라는 오늘은 그냥 잡담",
    createdAt: "2026-07-10T03:00:00.000Z",
  },
];

describe("extractFinzMentions", () => {
  it("대화에서 주요 주식/코인과 방향을 추출", () => {
    const mentions = extractFinzMentions(messages);

    expect(mentions.map((mention) => [mention.symbol, mention.direction])).toEqual([
      ["NVDA", "positive"],
      ["BTC", "conditional"],
      ["TSLA", "mention"],
    ]);
  });
});

describe("buildFinzMonthlyReview", () => {
  it("최초 정기 리뷰는 이전 전체 대화를 요약하고 첫 확보 가능 시가를 기준으로 삼음", async () => {
    const review = await buildFinzMonthlyReview({
      roomId: "room-1",
      kind: "scheduled-monthly",
      requestedAt: "2026-06-30T03:00:00.000Z",
      messages,
      priceProvider,
    });

    expect(review.updatesMonthlyBaseline).toBe(true);
    expect(review.periodStart).toBe("2026-06-10T03:00:00.000Z");
    expect(review.mentions.map((mention) => mention.symbol).sort()).toEqual(["BTC", "NVDA"]);
    expect(review.priceSnapshots.find((snapshot) => snapshot.symbol === "NVDA")?.baselineSource).toBe(
      "first-available-price-for-first-review",
    );
  });

  it("중간 리뷰는 마지막 리뷰 이후 대화를 보지만 정기 기준선을 갱신하지 않음", async () => {
    const previousScheduledReview = makePreviousScheduledReview();
    const manualReview = await buildFinzMonthlyReview({
      roomId: "room-1",
      kind: "manual-interim",
      requestedAt: "2026-07-15T03:00:00.000Z",
      messages,
      previousReviews: [previousScheduledReview],
      priceProvider,
    });

    expect(manualReview.updatesMonthlyBaseline).toBe(false);
    expect(manualReview.periodStart).toBe(previousScheduledReview.createdAt);
    expect(manualReview.baselineScheduledReviewId).toBe(previousScheduledReview.id);
    expect(manualReview.priceSnapshots[0]?.baselineSource).toBe("previous-scheduled-review-open");
  });

  it("정기 리뷰는 중간 리뷰가 있어도 전달 정기 리뷰 시가를 기준으로 삼음", async () => {
    const previousScheduledReview = makePreviousScheduledReview();
    const manualReview: FinzReviewRecord = {
      ...previousScheduledReview,
      id: "manual-1",
      kind: "manual-interim",
      createdAt: "2026-07-15T03:00:00.000Z",
      periodEnd: "2026-07-15T03:00:00.000Z",
      updatesMonthlyBaseline: false,
    };

    const scheduledReview = await buildFinzMonthlyReview({
      roomId: "room-1",
      kind: "scheduled-monthly",
      requestedAt: "2026-07-31T03:00:00.000Z",
      messages,
      previousReviews: [previousScheduledReview, manualReview],
      priceProvider,
    });

    expect(scheduledReview.updatesMonthlyBaseline).toBe(true);
    expect(scheduledReview.periodStart).toBe(previousScheduledReview.createdAt);
    expect(scheduledReview.previousReviewId).toBe(manualReview.id);
    expect(scheduledReview.baselineScheduledReviewId).toBe(previousScheduledReview.id);
  });
});

function makePreviousScheduledReview(): FinzReviewRecord {
  return {
    id: "scheduled-2026-06",
    roomId: "room-1",
    kind: "scheduled-monthly",
    periodStart: "2026-06-01T00:00:00.000Z",
    periodEnd: "2026-06-30T03:00:00.000Z",
    createdAt: "2026-06-30T03:00:00.000Z",
    updatesMonthlyBaseline: true,
    mentions: [],
    priceSnapshots: [
      {
        symbol: "TSLA",
        assetName: "Tesla",
        assetType: "stock",
        baselinePrice: 160,
        baselineObservedAt: "2026-06-01T03:00:00.000Z",
        baselineSource: "first-available-price-for-first-review",
        reviewOpenPrice: 180,
        reviewOpenObservedAt: "2026-06-30T03:00:00.000Z",
        currency: "USD",
        priceDiff: 20,
        returnRate: 12.5,
      },
    ],
    summaryText: "previous",
  };
}
