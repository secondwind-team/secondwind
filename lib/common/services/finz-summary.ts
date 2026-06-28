// FINZ "대화 요약" — 요약 대상 메시지 범위(window)를 정하는 순수 헬퍼 + LLM 입력용 트랜스크립트 빌더.
// I/O 없음(단위 테스트 대상). 실제 LLM 호출·append 는 summary 라우트가 한다.
//
// 규칙(사용자 요구):
//  - 사용자가 "어제부터 / 최근 1시간 / 최근 50개" 처럼 명시적 기간을 주면 그대로 따른다.
//  - 없으면 최근 메시지가 100개를 넘을 때만 최근 100개를, 아니면 전체를 요약한다.
//
// 기간 파싱은 결정적 정규식(LLM 흔들림 회피·테스트 가능). KST 기준(앱이 한국 사용자 기준).

import type { FinzChatMessage } from "./finz-chat";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 명시 개수 요청의 상한 — HARD_CEILING(400) 아래로 안전하게 제한.
const MAX_EXPLICIT_COUNT = 200;
// 기본 윈도(명시 기간 없음): 이 개수를 넘으면 최근 N개만.
export const DEFAULT_RECENT_WINDOW = 100;

export type SummaryScope = "explicit-count" | "explicit-since" | "recent" | "all";

export type SummaryWindow = {
  messages: FinzChatMessage[]; // 요약 대상으로 추려진 메시지(시간순 유지)
  label: string; // 사용자에게 보여줄 범위 라벨("오늘" · "최근 1시간" · "최근 100개" · "전체 대화" 등)
  scope: SummaryScope;
};

// KST 자정(dayOffset 일 가감)에 해당하는 UTC ms. dayOffset=0 → 오늘 00:00 KST, -1 → 어제 00:00 KST.
function kstMidnightMs(nowMs: number, dayOffset: number): number {
  const kst = new Date(nowMs + KST_OFFSET_MS);
  kst.setUTCHours(0, 0, 0, 0);
  kst.setUTCDate(kst.getUTCDate() + dayOffset);
  return kst.getTime() - KST_OFFSET_MS;
}

function filterSince(messages: FinzChatMessage[], sinceMs: number): FinzChatMessage[] {
  return messages.filter((m) => {
    const ms = Date.parse(m.createdAt);
    return Number.isFinite(ms) && ms >= sinceMs;
  });
}

// 사용자 텍스트에서 명시적 범위를 파싱해 요약 대상 메시지를 고른다. 없으면 기본 규칙(100개/전체).
// messages 는 seq 오름차순(시간순) 가정. nowMs 는 호출부가 Date.now() 로 주입(테스트는 고정값).
export function resolveSummaryWindow(
  text: string,
  messages: FinzChatMessage[],
  nowMs: number,
): SummaryWindow {
  const total = messages.length;
  const t = (text ?? "").trim();

  // 1) 개수: "최근/마지막/지난 N개"
  const countM = t.match(/(?:최근|마지막|지난)\s*(\d{1,4})\s*개/);
  if (countM?.[1]) {
    const n = Math.min(Math.max(parseInt(countM[1], 10), 1), MAX_EXPLICIT_COUNT);
    return { messages: messages.slice(-n), label: `최근 ${n}개`, scope: "explicit-count" };
  }

  // 2) 기간(일/시간/분 합산): "3일", "1시간 30분", "30분"
  const dayM = t.match(/(\d{1,3})\s*일/);
  const hourM = t.match(/(\d{1,3})\s*시간/);
  const minM = t.match(/(\d{1,3})\s*분/);
  if (dayM || hourM || minM) {
    const days = dayM?.[1] ? parseInt(dayM[1], 10) : 0;
    const hours = hourM?.[1] ? parseInt(hourM[1], 10) : 0;
    const mins = minM?.[1] ? parseInt(minM[1], 10) : 0;
    const totalMin = days * 1440 + hours * 60 + mins;
    if (totalMin > 0) {
      const sinceMs = nowMs - totalMin * 60 * 1000;
      const label = days
        ? `최근 ${days}일`
        : hours && mins
          ? `최근 ${hours}시간 ${mins}분`
          : hours
            ? `최근 ${hours}시간`
            : `최근 ${mins}분`;
      return { messages: filterSince(messages, sinceMs), label, scope: "explicit-since" };
    }
  }

  // 3) 오늘 / 어제
  if (/오늘/.test(t)) {
    return { messages: filterSince(messages, kstMidnightMs(nowMs, 0)), label: "오늘", scope: "explicit-since" };
  }
  if (/어제/.test(t)) {
    return { messages: filterSince(messages, kstMidnightMs(nowMs, -1)), label: "어제부터", scope: "explicit-since" };
  }

  // 4) 기본: 100개 초과면 최근 100개, 아니면 전체.
  if (total > DEFAULT_RECENT_WINDOW) {
    return { messages: messages.slice(-DEFAULT_RECENT_WINDOW), label: `최근 ${DEFAULT_RECENT_WINDOW}개`, scope: "recent" };
  }
  return { messages, label: "전체 대화", scope: "all" };
}

// 메시지 → LLM 입력용 트랜스크립트("이름: 내용" 줄). system/요약 메시지는 제외(잡음·재귀 회피).
// 너무 길면 오래된 줄부터 버려 최근 대화를 보존한다(토큰 예산).
export function buildSummaryTranscript(messages: FinzChatMessage[], maxChars = 6000): string {
  const lines: string[] = [];
  for (const m of messages) {
    let line: string | null = null;
    switch (m.kind) {
      case "text":
        line = `${m.role === "finz" ? "finz" : m.authorName}: ${m.text}`;
        break;
      case "position":
        line = `${m.authorName}: (입장: ${m.payload.stance})${m.payload.note ? ` ${m.payload.note}` : ""}`;
        break;
      case "pick":
        line = `finz: [오늘의 우정주: ${m.payload.name}]`;
        break;
      case "chart":
        line = `finz: [차트: ${m.payload.label || m.payload.symbol}]`;
        break;
      default:
        line = null; // system, summary 제외
    }
    if (line && line.trim()) lines.push(line.trim());
  }

  // 최근 줄을 보존하며 maxChars 이하로 자른다(오래된 줄부터 드롭).
  const kept: string[] = [];
  let size = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const ln = lines[i]!;
    const add = ln.length + 1;
    if (size + add > maxChars && kept.length > 0) break;
    kept.unshift(ln);
    size += add;
  }
  return kept.join("\n");
}

// 요약할 만큼 대화가 쌓였는지(트랜스크립트 줄 수). 라우트가 LLM 호출 전 가드에 쓴다.
export function summarizableLineCount(messages: FinzChatMessage[]): number {
  return buildSummaryTranscript(messages).split("\n").filter((l) => l.length > 0).length;
}
