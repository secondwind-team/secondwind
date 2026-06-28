import { describe, expect, it } from "vitest";
import {
  computeNextRun,
  describeRecurring,
  formatRecurringSchedule,
  isFinzRecurringMessage,
  normalizeRecurringInput,
  type FinzRecurringMessage,
} from "./finz-recurring";

// 2026-06-28T05:00:00Z = 일요일 14:00 KST.
const NOW = Date.parse("2026-06-28T05:00:00Z");

describe("normalizeRecurringInput", () => {
  it("daily 시각을 정규화", () => {
    const n = normalizeRecurringInput({ contentKind: "text", content: " 물 마시기 ", freq: "daily", hour: 9, minute: 0 });
    expect(n).toEqual({ contentKind: "text", content: "물 마시기", freq: "daily", hour: 9, minute: 0, weekday: 0, intervalMinutes: 0 });
  });

  it("weekly 는 weekday 필요", () => {
    expect(normalizeRecurringInput({ content: "회의", freq: "weekly", hour: 9, minute: 0 })).toBeNull();
    const n = normalizeRecurringInput({ content: "회의 알림", freq: "weekly", hour: 9, minute: 30, weekday: 1 });
    expect(n?.freq).toBe("weekly");
    expect(n?.weekday).toBe(1);
  });

  it("interval 은 최소 30분으로 clamp", () => {
    const n = normalizeRecurringInput({ content: "스트레칭", freq: "interval", intervalMinutes: 5 });
    expect(n?.freq).toBe("interval");
    expect(n?.intervalMinutes).toBe(30);
  });

  it("ai contentKind 보존, 그 외는 text 기본", () => {
    expect(normalizeRecurringInput({ contentKind: "ai", content: "오늘의 명언", freq: "daily", hour: 8, minute: 0 })?.contentKind).toBe("ai");
    expect(normalizeRecurringInput({ content: "x", freq: "daily", hour: 8, minute: 0 })?.contentKind).toBe("text");
  });

  it("내용 없음/주기 불명/시각 범위 밖이면 null", () => {
    expect(normalizeRecurringInput({ content: "", freq: "daily", hour: 9 })).toBeNull();
    expect(normalizeRecurringInput({ content: "x", freq: "yearly", hour: 9 })).toBeNull();
    expect(normalizeRecurringInput({ content: "x", freq: "daily", hour: 25 })).toBeNull();
    expect(normalizeRecurringInput(null)).toBeNull();
  });

  it("minute 는 0-59 로 clamp, 없으면 0", () => {
    expect(normalizeRecurringInput({ content: "x", freq: "daily", hour: 9 })?.minute).toBe(0);
    expect(normalizeRecurringInput({ content: "x", freq: "daily", hour: 9, minute: 75 })?.minute).toBe(59);
  });
});

describe("computeNextRun", () => {
  it("daily — 오늘 시각이 지났으면 내일", () => {
    // 14:00 KST 기준 9:00 은 지남 → 내일 9:00 KST = 2026-06-29T00:00:00Z
    const next = computeNextRun({ freq: "daily", hour: 9, minute: 0, weekday: 0, intervalMinutes: 0 }, NOW);
    expect(new Date(next).toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("daily — 오늘 시각이 아직이면 오늘", () => {
    // 14:00 KST 기준 21:00 은 아직 → 오늘 21:00 KST = 2026-06-28T12:00:00Z
    const next = computeNextRun({ freq: "daily", hour: 21, minute: 0, weekday: 0, intervalMinutes: 0 }, NOW);
    expect(new Date(next).toISOString()).toBe("2026-06-28T12:00:00.000Z");
  });

  it("weekly — 다음 해당 요일", () => {
    // 오늘 일(0). 월요일(1) 9:00 → 내일 = 2026-06-29(월) 09:00 KST = 2026-06-29T00:00:00Z
    const next = computeNextRun({ freq: "weekly", hour: 9, minute: 0, weekday: 1, intervalMinutes: 0 }, NOW);
    expect(new Date(next).toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("weekly — 오늘이 그 요일인데 시각 지났으면 다음 주", () => {
    // 오늘 일(0) 14:00. 일요일 9:00 은 지남 → 다음 일요일 = 2026-07-05 09:00 KST = 2026-07-05T00:00:00Z
    const next = computeNextRun({ freq: "weekly", hour: 9, minute: 0, weekday: 0, intervalMinutes: 0 }, NOW);
    expect(new Date(next).toISOString()).toBe("2026-07-05T00:00:00.000Z");
  });

  it("interval — fromMs + intervalMinutes", () => {
    const next = computeNextRun({ freq: "interval", hour: 0, minute: 0, weekday: 0, intervalMinutes: 30 }, NOW);
    expect(next).toBe(NOW + 30 * 60_000);
  });
});

describe("formatRecurringSchedule / describeRecurring", () => {
  it("주기 라벨", () => {
    expect(formatRecurringSchedule({ freq: "daily", hour: 9, minute: 0, weekday: 0, intervalMinutes: 0 })).toBe("매일 오전 9:00");
    expect(formatRecurringSchedule({ freq: "daily", hour: 15, minute: 5, weekday: 0, intervalMinutes: 0 })).toBe("매일 오후 3:05");
    expect(formatRecurringSchedule({ freq: "weekly", hour: 9, minute: 0, weekday: 1, intervalMinutes: 0 })).toBe("매주 월요일 오전 9:00");
    expect(formatRecurringSchedule({ freq: "interval", hour: 0, minute: 0, weekday: 0, intervalMinutes: 30 })).toBe("30분마다");
    expect(formatRecurringSchedule({ freq: "interval", hour: 0, minute: 0, weekday: 0, intervalMinutes: 120 })).toBe("2시간마다");
  });

  it("describe 한 줄", () => {
    expect(
      describeRecurring({ freq: "daily", hour: 9, minute: 0, weekday: 0, intervalMinutes: 0, contentKind: "text", content: "물 마시기" }),
    ).toBe("매일 오전 9:00에 '물 마시기'");
    expect(
      describeRecurring({ freq: "daily", hour: 8, minute: 0, weekday: 0, intervalMinutes: 0, contentKind: "ai", content: "오늘의 명언" }),
    ).toBe("매일 오전 8:00에 '오늘의 명언' (AI 생성)");
  });
});

describe("isFinzRecurringMessage", () => {
  const valid: FinzRecurringMessage = {
    id: "abc",
    roomId: "room01",
    createdBy: "u1",
    contentKind: "text",
    content: "물",
    freq: "daily",
    hour: 9,
    minute: 0,
    weekday: 0,
    intervalMinutes: 0,
    enabled: true,
    createdAt: "2026-06-28T00:00:00Z",
    nextRunAt: NOW,
    lastRunAt: 0,
  };
  it("유효한 정의 통과, 깨진 건 거부", () => {
    expect(isFinzRecurringMessage(valid)).toBe(true);
    expect(isFinzRecurringMessage({ ...valid, freq: "monthly" })).toBe(false);
    expect(isFinzRecurringMessage({ ...valid, nextRunAt: "soon" })).toBe(false);
    expect(isFinzRecurringMessage(null)).toBe(false);
  });
});
