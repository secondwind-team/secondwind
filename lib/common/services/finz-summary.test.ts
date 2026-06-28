import { describe, expect, it } from "vitest";
import {
  buildSummaryTranscript,
  resolveSummaryWindow,
  summarizableLineCount,
} from "./finz-summary";
import type { FinzChatMessage } from "./finz-chat";

// 고정 now: 2026-06-28T05:00:00Z = 14:00 KST.
const NOW = Date.parse("2026-06-28T05:00:00Z");

function textMsg(seq: number, iso: string, text = `m${seq}`, authorName = "민수"): FinzChatMessage {
  return {
    id: `id-${seq}`,
    role: "member",
    authorId: "u1",
    authorName,
    kind: "text",
    text,
    createdAt: iso,
    seq,
  };
}

// seq i, 시각 = NOW - (count-1-i) 분 (가장 최근이 NOW).
function recentTexts(count: number): FinzChatMessage[] {
  return Array.from({ length: count }, (_, i) =>
    textMsg(i, new Date(NOW - (count - 1 - i) * 60_000).toISOString(), `m${i}`),
  );
}

describe("resolveSummaryWindow — 명시 기간", () => {
  it("'최근 N개' → 마지막 N개", () => {
    const msgs = recentTexts(50);
    const w = resolveSummaryWindow("최근 10개 요약해줘", msgs, NOW);
    expect(w.scope).toBe("explicit-count");
    expect(w.messages).toHaveLength(10);
    expect(w.messages[0]?.id).toBe("id-40");
    expect(w.label).toBe("최근 10개");
  });

  it("'최근 N시간' → now-N시간 이후만", () => {
    // 200분치 메시지(0~199분 전). "최근 1시간"이면 마지막 60분(60~61개) 정도.
    const msgs = recentTexts(200);
    const w = resolveSummaryWindow("최근 1시간 요약", msgs, NOW);
    expect(w.scope).toBe("explicit-since");
    expect(w.label).toBe("최근 1시간");
    // 60분 전(=NOW-60m) 이후 메시지만. 경계 포함이라 61개.
    expect(w.messages.length).toBe(61);
    expect(w.messages.every((m) => Date.parse(m.createdAt) >= NOW - 60 * 60_000)).toBe(true);
  });

  it("'30분' → now-30분 이후만", () => {
    const msgs = recentTexts(200);
    const w = resolveSummaryWindow("30분 요약", msgs, NOW);
    expect(w.label).toBe("최근 30분");
    expect(w.messages.length).toBe(31);
  });

  it("'오늘' → KST 오늘 자정 이후만", () => {
    // 어제 23:00 KST, 오늘 09:00 KST, 오늘 13:00 KST 세 개.
    const msgs = [
      textMsg(0, "2026-06-27T14:00:00Z"), // 어제 23:00 KST
      textMsg(1, "2026-06-28T00:00:00Z"), // 오늘 09:00 KST
      textMsg(2, "2026-06-28T04:00:00Z"), // 오늘 13:00 KST
    ];
    const w = resolveSummaryWindow("오늘 대화 요약해줘", msgs, NOW);
    expect(w.label).toBe("오늘");
    expect(w.messages.map((m) => m.seq)).toEqual([1, 2]);
  });

  it("'어제' → KST 어제 자정 이후 전부(어제+오늘)", () => {
    const msgs = [
      textMsg(0, "2026-06-26T14:00:00Z"), // 그제 23:00 KST
      textMsg(1, "2026-06-27T01:00:00Z"), // 어제 10:00 KST
      textMsg(2, "2026-06-28T04:00:00Z"), // 오늘 13:00 KST
    ];
    const w = resolveSummaryWindow("어제부터 요약", msgs, NOW);
    expect(w.label).toBe("어제부터");
    expect(w.messages.map((m) => m.seq)).toEqual([1, 2]);
  });
});

describe("resolveSummaryWindow — 기본 규칙", () => {
  it("100개 초과면 최근 100개", () => {
    const msgs = recentTexts(150);
    const w = resolveSummaryWindow("요약해줘", msgs, NOW);
    expect(w.scope).toBe("recent");
    expect(w.label).toBe("최근 100개");
    expect(w.messages).toHaveLength(100);
    expect(w.messages[0]?.id).toBe("id-50");
  });

  it("100개 이하면 전체", () => {
    const msgs = recentTexts(40);
    const w = resolveSummaryWindow("요약", msgs, NOW);
    expect(w.scope).toBe("all");
    expect(w.label).toBe("전체 대화");
    expect(w.messages).toHaveLength(40);
  });

  it("정확히 100개면 전체(초과 아님)", () => {
    const w = resolveSummaryWindow("요약", recentTexts(100), NOW);
    expect(w.scope).toBe("all");
    expect(w.messages).toHaveLength(100);
  });
});

describe("buildSummaryTranscript", () => {
  it("이름:내용 줄로 만들고 system 제외", () => {
    const msgs: FinzChatMessage[] = [
      textMsg(0, "2026-06-28T04:00:00Z", "안녕", "민수"),
      { id: "s", role: "system", authorId: "system", authorName: "", kind: "system", text: "들어옴", createdAt: "2026-06-28T04:01:00Z", seq: 1 },
      { id: "f", role: "finz", authorId: "finz", authorName: "FINZ", kind: "text", text: "반가워", createdAt: "2026-06-28T04:02:00Z", seq: 2 },
    ];
    const t = buildSummaryTranscript(msgs);
    expect(t).toBe("민수: 안녕\nfinz: 반가워");
    expect(summarizableLineCount(msgs)).toBe(2);
  });

  it("오래된 줄부터 잘라 최근을 보존", () => {
    const msgs = recentTexts(10).map((m, i) => textMsg(i, m.createdAt, "x".repeat(50)));
    const t = buildSummaryTranscript(msgs, 120);
    // 각 줄 "민수: " + 50 = ~57자. 120자면 최근 두 줄 정도만.
    expect(t.length).toBeLessThanOrEqual(120);
    expect(t.split("\n").length).toBeLessThan(10);
  });
});
