import { describe, expect, it } from "vitest";
import { isShareId, parseSnapshot } from "./travel-share-store";

const validInput = {
  destination: "제주",
  startDate: "2026-05-01",
  endDate: "2026-05-03",
  prompt: "조용히",
  planningModel: "balanced",
};

const validPlan = {
  rationale: "x",
  days: [{ label: "1일", items: [{ text: "출발", place_query: "" }] }],
  budget: { extras: [] },
  caveats: [],
};

const validSnapshot = {
  input: validInput,
  plan: validPlan,
  model: "gemini-2.5-flash-lite",
  createdAt: "2026-04-29T00:00:00.000Z",
  expiresAt: "2026-05-06T00:00:00.000Z",
};

describe("isShareId", () => {
  it("정확히 6자 alphanumeric 만 통과", () => {
    expect(isShareId("abc123")).toBe(true);
    expect(isShareId("ABCdef")).toBe(true);
  });

  it("길이가 다르면 거절", () => {
    expect(isShareId("abc12")).toBe(false);
    expect(isShareId("abc1234")).toBe(false);
  });

  it("alphanumeric 외 문자 포함 시 거절", () => {
    expect(isShareId("abc-12")).toBe(false);
    expect(isShareId("abc 12")).toBe(false);
    expect(isShareId("한글23")).toBe(false);
  });
});

describe("parseSnapshot", () => {
  it("정상 객체 입력은 그대로 정규화", () => {
    const out = parseSnapshot(validSnapshot);
    expect(out).not.toBeNull();
    expect(out?.input.destination).toBe("제주");
    expect(out?.plan.rationale).toBe("x");
    expect(out?.model).toBe("gemini-2.5-flash-lite");
  });

  it("문자열 JSON 도 파싱", () => {
    expect(parseSnapshot(JSON.stringify(validSnapshot))).not.toBeNull();
  });

  it("input 이 검증 실패하면 null", () => {
    const broken = { ...validSnapshot, input: { ...validInput, destination: "" } };
    expect(parseSnapshot(broken)).toBeNull();
  });

  it("plan 이 검증 실패하면 null", () => {
    const broken = { ...validSnapshot, plan: { ...validPlan, days: "not-array" } };
    expect(parseSnapshot(broken)).toBeNull();
  });

  it("createdAt 이 누락되거나 잘못된 ISO 면 null", () => {
    expect(parseSnapshot({ ...validSnapshot, createdAt: "" })).toBeNull();
    expect(parseSnapshot({ ...validSnapshot, createdAt: "not-a-date" })).toBeNull();
  });

  it("expiresAt 이 누락되거나 잘못된 ISO 면 null", () => {
    expect(parseSnapshot({ ...validSnapshot, expiresAt: "" })).toBeNull();
  });

  it("model 누락은 OK (optional)", () => {
    const noModel = { ...validSnapshot };
    delete (noModel as { model?: string }).model;
    const out = parseSnapshot(noModel);
    expect(out?.model).toBeUndefined();
  });

  it("null/undefined/숫자 입력은 null", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(undefined)).toBeNull();
    expect(parseSnapshot(42)).toBeNull();
  });

  it("손상된 JSON 문자열은 null", () => {
    expect(parseSnapshot("{not-json")).toBeNull();
  });
});
