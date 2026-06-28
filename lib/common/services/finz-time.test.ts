import { describe, expect, it } from "vitest";
import { formatKstDate, formatKstTime, isSameKstDay, kstDayKey } from "./finz-time";

describe("finz-time", () => {
  it("formats KST time with 오전/오후 (12h)", () => {
    // 2026-06-28T06:05:00Z = 15:05 KST → 오후 3:05
    expect(formatKstTime("2026-06-28T06:05:00Z")).toBe("오후 3:05");
    // 00:30 KST → 오전 12:30
    expect(formatKstTime("2026-06-27T15:30:00Z")).toBe("오전 12:30");
    // 09:00 KST → 오전 9:00
    expect(formatKstTime("2026-06-28T00:00:00Z")).toBe("오전 9:00");
  });

  it("formats KST date with weekday", () => {
    // 2026-06-28 is a Sunday
    expect(formatKstDate("2026-06-28T06:05:00Z")).toBe("2026년 6월 28일 (일)");
  });

  it("computes KST day key (calendar day, not UTC)", () => {
    // 2026-06-27T15:30:00Z = 2026-06-28 00:30 KST → KST 일자는 28일
    expect(kstDayKey("2026-06-27T15:30:00Z")).toBe("2026-06-28");
    // 2026-06-27T14:00:00Z = 2026-06-27 23:00 KST → 아직 27일
    expect(kstDayKey("2026-06-27T14:00:00Z")).toBe("2026-06-27");
  });

  it("detects same KST day across the UTC midnight boundary", () => {
    // 둘 다 KST 28일(UTC 로는 27일/28일로 갈림) — 같은 날로 봐야 한다.
    expect(isSameKstDay("2026-06-27T15:30:00Z", "2026-06-28T05:00:00Z")).toBe(true);
    // KST 27일 23:00 vs 28일 00:30 — 다른 날.
    expect(isSameKstDay("2026-06-27T14:00:00Z", "2026-06-27T15:30:00Z")).toBe(false);
  });

  it("returns empty string for unparseable input (caller guards truthiness)", () => {
    expect(formatKstTime("not-a-date")).toBe("");
    expect(formatKstDate("")).toBe("");
    expect(kstDayKey("garbage")).toBe("");
    expect(isSameKstDay("garbage", "garbage")).toBe(false);
  });
});
