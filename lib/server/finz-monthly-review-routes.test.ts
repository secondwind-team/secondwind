import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  group: null as null | { members: Array<{ memberId: string }> },
  run: vi.fn(),
  rooms: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/server/finz-group-store", () => ({
  isFinzGroupId: (id: string) => id === "abc123",
  getFinzGroup: vi.fn(async () => h.group),
}));

vi.mock("@/lib/server/finz-monthly-review-runner", () => ({
  runFinzMonthlyReview: h.run,
}));

vi.mock("@/lib/server/finz-monthly-review-store", () => ({
  listFinzMonthlyReviewRooms: h.rooms,
  unsubscribeFinzMonthlyReview: h.unsubscribe,
}));

import { GET as cronGet } from "@/app/api/finz/cron/monthly-review/route";
import { POST as manualPost } from "@/app/api/finz/party/[groupId]/monthly-review/route";

function params(groupId = "abc123") {
  return { params: Promise.resolve({ groupId }) };
}

function post(body: string) {
  return new Request("http://local/api/finz/party/abc123/monthly-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function cronRequest(secret = "secret") {
  return new Request("http://local/api/finz/cron/monthly-review", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.group = { members: [{ memberId: "member-1" }] };
  h.rooms.mockResolvedValue([]);
  process.env.CRON_SECRET = "secret";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T03:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
});

describe("manual monthly-review route", () => {
  it("invalid id, invalid JSON, missing group을 각각 거절", async () => {
    expect((await manualPost(post("{}"), params("bad"))).status).toBe(400);
    expect((await manualPost(post("{"), params())).status).toBe(400);
    h.group = null;
    expect((await manualPost(post('{"memberId":"member-1"}'), params())).status).toBe(404);
    expect(h.run).not.toHaveBeenCalled();
  });

  it("방 멤버가 아닌 요청을 403으로 거절", async () => {
    const response = await manualPost(post('{"memberId":"outsider"}'), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: "not-member" });
  });

  it("busy는 성공 dedupe, not-found와 runner 오류는 대응 상태로 변환", async () => {
    h.run.mockResolvedValueOnce({ status: "busy" });
    const busy = await manualPost(post('{"memberId":"member-1"}'), params());
    expect(await busy.json()).toEqual({ status: "ok", deduped: true });

    h.run.mockResolvedValueOnce({ status: "not-found" });
    expect((await manualPost(post('{"memberId":"member-1"}'), params())).status).toBe(404);

    h.run.mockResolvedValueOnce({ status: "append-failed" });
    const failed = await manualPost(post('{"memberId":"member-1"}'), params());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ reason: "append-failed" });
  });

  it("성공 리뷰를 반환하고 예외는 review-failed로 격리", async () => {
    const review = { id: "review-1" };
    h.run.mockResolvedValueOnce({ status: "ok", review });
    const success = await manualPost(post('{"memberId":"member-1"}'), params());
    expect(await success.json()).toEqual({ status: "ok", review });
    expect(h.run).toHaveBeenCalledWith({ roomId: "abc123", kind: "manual-interim" });

    h.run.mockRejectedValueOnce(new Error("provider down"));
    const failed = await manualPost(post('{"memberId":"member-1"}'), params());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ reason: "review-failed" });
  });
});

describe("scheduled monthly-review route", () => {
  it("미설정/오류 secret을 차단하고 말일이 아니면 저장소를 읽지 않음", async () => {
    delete process.env.CRON_SECRET;
    expect((await cronGet(cronRequest())).status).toBe(503);

    process.env.CRON_SECRET = "secret";
    expect((await cronGet(cronRequest("wrong"))).status).toBe(401);

    vi.setSystemTime(new Date("2026-07-30T03:00:00.000Z"));
    const skipped = await cronGet(cronRequest());
    expect(await skipped.json()).toMatchObject({ skipped: true, reason: "not-kst-month-end" });
    expect(h.rooms).not.toHaveBeenCalled();
  });

  it("방별 결과를 격리하고 사라진 방만 구독 해제", async () => {
    h.rooms.mockResolvedValue(["abc123", "gone123", "error123"]);
    h.run
      .mockResolvedValueOnce({ status: "ok", review: { id: "r1" } })
      .mockResolvedValueOnce({ status: "not-found" })
      .mockRejectedValueOnce(new Error("one room failed"));

    const response = await cronGet(cronRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      results: [
        { roomId: "abc123", status: "ok" },
        { roomId: "gone123", status: "not-found" },
        { roomId: "error123", status: "error" },
      ],
    });
    expect(h.rooms).toHaveBeenCalledWith(50);
    expect(h.unsubscribe).toHaveBeenCalledWith("gone123");
    expect(h.run).toHaveBeenNthCalledWith(1, {
      roomId: "abc123",
      kind: "scheduled-monthly",
      requestedAt: "2026-07-31T03:00:00.000Z",
    });
  });
});
