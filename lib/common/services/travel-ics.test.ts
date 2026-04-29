import { describe, expect, it } from "vitest";
import { buildIcsFilename, dateForDay, escapeText, generateIcs } from "./travel-ics";
import type { TravelInput, TravelPlan } from "./travel";

const fixedNow = new Date("2026-04-29T12:00:00.000Z");

const baseInput: TravelInput = {
  destination: "제주",
  startDate: "2026-05-01",
  endDate: "2026-05-03",
  prompt: "조용히",
  planningModel: "balanced",
};

const basePlan: TravelPlan = {
  rationale: "test",
  days: [
    {
      label: "1일차",
      items: [
        {
          text: "성산일출봉 등반",
          time: "09:00",
          place_query: "성산일출봉",
          place: { name: "성산일출봉", address: "제주 서귀포시 성산읍" },
          cost_krw: 5000,
          cost_label: "입장료",
        },
        {
          text: "흑돼지 점심",
          time: "12:30",
          place_query: "흑돈가",
          place: { name: "흑돈가", address: "제주 서귀포시 ..." },
          cost_krw: 60000,
          cost_label: "식사",
          recommended_menu: "흑돼지 두루치기",
          transit: { mode: "차량", duration_min: 25, cost_krw: 0 },
        },
      ],
    },
    {
      label: "2일차",
      items: [
        {
          text: "여유롭게 조식",
          place_query: "",
        },
        {
          text: "월정리 해변",
          time: "10:00",
          place_query: "월정리해변",
        },
      ],
    },
  ],
  budget: { extras: [] },
  caveats: [],
};

describe("dateForDay", () => {
  it("정상 startDate + 0 → 그날", () => {
    expect(dateForDay("2026-05-01", 0)).toBe("20260501");
  });

  it("dayOffset 적용", () => {
    expect(dateForDay("2026-05-01", 2)).toBe("20260503");
  });

  it("월 경계 넘어감", () => {
    expect(dateForDay("2026-05-30", 3)).toBe("20260602");
  });

  it("잘못된 형식은 undefined", () => {
    expect(dateForDay("2026/05/01", 0)).toBeUndefined();
    expect(dateForDay("not-a-date", 0)).toBeUndefined();
  });
});

describe("escapeText", () => {
  it("쉼표·세미콜론·백슬래시·줄바꿈 escape", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("한글 그대로 보존", () => {
    expect(escapeText("성산일출봉")).toBe("성산일출봉");
  });

  it("CRLF 도 \\n 으로", () => {
    expect(escapeText("a\r\nb")).toBe("a\\nb");
  });
});

describe("buildIcsFilename", () => {
  it("destination + startDate", () => {
    expect(buildIcsFilename(baseInput)).toBe("제주-2026-05-01.ics");
  });

  it("filesystem-unsafe 문자 sanitize", () => {
    expect(buildIcsFilename({ ...baseInput, destination: "제주/서귀포 *test" })).toBe("제주-서귀포--test-2026-05-01.ics");
  });

  it("destination 빈 문자열은 'travel' fallback", () => {
    expect(buildIcsFilename({ ...baseInput, destination: "   " })).toBe("travel-2026-05-01.ics");
  });
});

describe("generateIcs", () => {
  it("최소 구조 — VCALENDAR + VEVENT", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("\r\nEND:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//secondwind//travel//KO");
    expect(ics).toContain("X-WR-CALNAME:제주 여행");
  });

  it("time 있는 item 만 VEVENT 로", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    // 1일차 2개 + 2일차 1개 (2일차 첫 item 은 time 없음)
    expect(veventCount).toBe(3);
  });

  it("DTSTART floating time 포맷 + day offset 적용", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics).toContain("DTSTART:20260501T090000");
    expect(ics).toContain("DTSTART:20260501T123000");
    expect(ics).toContain("DTSTART:20260502T100000");
  });

  it("DTEND 는 default 60분 후", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics).toContain("DTSTART:20260501T090000");
    expect(ics).toContain("DTEND:20260501T100000");
  });

  it("LOCATION 은 place.address 우선, 없으면 place.name", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics).toContain("LOCATION:제주 서귀포시 성산읍");
  });

  it("DESCRIPTION 에 비용·추천메뉴·이동 포함", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics).toMatch(/DESCRIPTION:[^\r\n]*추천: 흑돼지 두루치기/);
    expect(ics).toMatch(/DESCRIPTION:[^\r\n]*예상 비용: 60\\,000원/);
    expect(ics).toMatch(/DESCRIPTION:[^\r\n]*이동: 차량 · 25분/);
  });

  it("같은 plan + 같은 item 위치는 같은 UID (재import update 처리)", () => {
    const ics1 = generateIcs(basePlan, baseInput, new Date("2026-04-29T12:00:00Z"));
    const ics2 = generateIcs(basePlan, baseInput, new Date("2026-05-15T08:00:00Z"));
    const uids1 = ics1.match(/UID:[^\r\n]+/g) ?? [];
    const uids2 = ics2.match(/UID:[^\r\n]+/g) ?? [];
    expect(uids1).toEqual(uids2);
    expect(uids1.length).toBe(3);
  });

  it("DTSTAMP 는 now 기반 UTC", () => {
    const ics = generateIcs(basePlan, baseInput, fixedNow);
    expect(ics).toContain("DTSTAMP:20260429T120000Z");
  });

  it("time 형식 잘못된 item 은 skip", () => {
    const plan: TravelPlan = {
      ...basePlan,
      days: [
        {
          label: "1일차",
          items: [
            { text: "정상", time: "09:00", place_query: "" },
            { text: "잘못", time: "9시", place_query: "" },
            { text: "범위초과", time: "25:00", place_query: "" },
          ],
        },
      ],
    };
    const ics = generateIcs(plan, baseInput, fixedNow);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  it("plan.days 가 비면 VEVENT 0개, VCALENDAR 만", () => {
    const empty: TravelPlan = { ...basePlan, days: [] };
    const ics = generateIcs(empty, baseInput, fixedNow);
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });
});
