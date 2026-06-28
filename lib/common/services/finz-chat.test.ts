import { describe, expect, it } from "vitest";
import {
  computeNextNudge,
  isFinzStoredChatMessage,
  mentionsFinz,
  selectLatestPick,
  selectLatestPositionsByMember,
  isFinzMentionIntent,
  normalizeChartSymbol,
  shouldFinzProactivelySpeak,
  splitByMention,
  stripFinzMention,
  type FinzChatMemberLite,
  type FinzChatMessage,
} from "./finz-chat";
import type { FinzPartyPick, FinzPartyStance, FinzPartySummary } from "./finz";

const PICK: FinzPartyPick = {
  name: "구독 경제",
  kind: "theme",
  oneLine: "대화 소재",
  whyThisParty: ["a"],
  rolePrompts: [
    { memberName: "지헌", role: "r", prompt: "p" },
    { memberName: "태훈", role: "r", prompt: "q" },
  ],
  debatePoint: "d",
  openingQuestions: ["q1"],
  conversationSeeds: ["s1"],
  caveats: ["투자 조언이 아니라 대화 소재"],
};
const SUMMARY: FinzPartySummary = { summary: "s", nextNudge: "n" };

function text(seq: number, authorId: string): FinzChatMessage {
  return { id: `t${seq}`, seq, role: "member", authorId, authorName: authorId, kind: "text", text: "hi", createdAt: "t" };
}
function pick(seq: number): FinzChatMessage {
  return { id: `p${seq}`, seq, role: "finz", authorId: "finz", authorName: "FINZ", kind: "pick", payload: PICK, createdAt: "t" };
}
function position(seq: number, authorId: string, stance: FinzPartyStance = "매력 있음", note = ""): FinzChatMessage {
  return { id: `pos${seq}`, seq, role: "member", authorId, authorName: authorId, kind: "position", payload: { stance, note }, createdAt: "t" };
}
function summary(seq: number): FinzChatMessage {
  return { id: `s${seq}`, seq, role: "finz", authorId: "finz", authorName: "FINZ", kind: "summary", payload: SUMMARY, createdAt: "t" };
}

const MEMBERS: FinzChatMemberLite[] = [
  { memberId: "a", displayName: "지헌", selectedCardIds: ["x"], joinedAt: "t" },
  { memberId: "b", displayName: "태훈", selectedCardIds: ["y"], joinedAt: "t" },
];

describe("selectLatestPick", () => {
  it("가장 높은 seq 의 픽을 고른다", () => {
    const msgs = [pick(1), text(2, "a"), pick(5), text(6, "b")];
    expect(selectLatestPick(msgs)?.seq).toBe(5);
  });
  it("픽이 없으면 null", () => {
    expect(selectLatestPick([text(1, "a")])).toBeNull();
  });
});

describe("selectLatestPositionsByMember", () => {
  it("현재 픽 이후의 멤버별 최신 포지션만", () => {
    const msgs = [pick(1), position(2, "a", "회의적"), position(3, "a", "매력 있음"), position(4, "b", "관망")];
    const m = selectLatestPositionsByMember(msgs, 1);
    expect(m.get("a")?.stance).toBe("매력 있음");
    expect(m.get("a")?.seq).toBe(3);
    expect(m.get("b")?.stance).toBe("관망");
  });
  it("옛 픽에 남긴 포지션은 제외(재추첨 리셋)", () => {
    const msgs = [pick(1), position(2, "a"), pick(5)]; // 새 픽 seq=5, 그 전 포지션 제외
    const m = selectLatestPositionsByMember(msgs, 5);
    expect(m.size).toBe(0);
  });
});

describe("computeNextNudge", () => {
  it("1명이면 invite", () => {
    expect(computeNextNudge([], [MEMBERS[0]!], "a")?.cta).toBe("invite");
  });
  it("2명 + 픽 없으면 pick", () => {
    expect(computeNextNudge([], MEMBERS, "a")?.cta).toBe("pick");
  });
  it("픽 있고 내 입장 없으면 position", () => {
    const n = computeNextNudge([pick(1)], MEMBERS, "a");
    expect(n?.cta).toBe("position");
    expect(n?.missingMemberName).toBeUndefined();
  });
  it("내 입장만 있고 상대 없으면 상대 이름과 함께 대기", () => {
    const n = computeNextNudge([pick(1), position(2, "a")], MEMBERS, "a");
    expect(n?.cta).toBe("position");
    expect(n?.missingMemberName).toBe("태훈");
  });
  it("둘 다 입장 + 요약 없으면 summary", () => {
    const n = computeNextNudge([pick(1), position(2, "a"), position(3, "b")], MEMBERS, "a");
    expect(n?.cta).toBe("summary");
  });
  it("둘 다 입장 + 최신 요약 있으면 null", () => {
    const n = computeNextNudge([pick(1), position(2, "a"), position(3, "b"), summary(4)], MEMBERS, "a");
    expect(n).toBeNull();
  });
  it("3인 방: 한 명이라도 미입장이면 summary 아니라 그 사람을 기다린다(조기 summary nudge 방지)", () => {
    const THREE: FinzChatMemberLite[] = [
      ...MEMBERS,
      { memberId: "c", displayName: "민지", selectedCardIds: ["z"], joinedAt: "t" },
    ];
    // a·b 입장했지만 c 미입장 → summary 가 아니라 미입장자(민지) 대기여야 한다.
    const waiting = computeNextNudge([pick(1), position(2, "a"), position(3, "b")], THREE, "a");
    expect(waiting?.cta).toBe("position");
    expect(waiting?.missingMemberName).toBe("민지");
    // 셋 다 입장 → summary.
    const ready = computeNextNudge([pick(1), position(2, "a"), position(3, "b"), position(4, "c")], THREE, "a");
    expect(ready?.cta).toBe("summary");
  });
});

describe("mentionsFinz", () => {
  it("@finz / @핀즈 / 대소문자 / 문장 중간 감지", () => {
    expect(mentionsFinz("@finz 오늘 주가 어때?")).toBe(true);
    expect(mentionsFinz("야 @FINZ 뉴스 알려줘")).toBe(true);
    expect(mentionsFinz("@핀즈 안녕")).toBe(true);
    expect(mentionsFinz("@finz야 이거 봐")).toBe(true);
  });
  it("@AI / @ai / @에이아이 별칭도 감지(메신저 봇 호출)", () => {
    expect(mentionsFinz("@AI 오늘 테슬라 주가 알려줘")).toBe(true);
    expect(mentionsFinz("@ai 안녕")).toBe(true);
    expect(mentionsFinz("@에이아이 뉴스")).toBe(true);
    expect(mentionsFinz("@AI야 알려줘")).toBe(true); // 뒤에 한글 조사 OK
  });
  it("멘션 없으면 false", () => {
    expect(mentionsFinz("그냥 대화")).toBe(false);
    expect(mentionsFinz("finz 좋다")).toBe(false); // @ 없음
    expect(mentionsFinz("email@finance.com")).toBe(false);
    expect(mentionsFinz("@airline 예약했어")).toBe(false); // 'ai' 라틴 연속은 봇 호출 아님
    expect(mentionsFinz("@aim 좋아")).toBe(false);
  });
});

describe("stripFinzMention", () => {
  it("멘션 토큰만 떼고 질문을 남긴다", () => {
    expect(stripFinzMention("@AI 오늘 테슬라 주가 알려줘")).toBe("오늘 테슬라 주가 알려줘");
    expect(stripFinzMention("@finz 뉴스 정리해줘")).toBe("뉴스 정리해줘");
    expect(stripFinzMention("@핀즈")).toBe("");
  });
});

describe("isFinzMentionIntent", () => {
  it("6개 의도만 통과", () => {
    expect(isFinzMentionIntent("pick")).toBe(true);
    expect(isFinzMentionIntent("summary")).toBe(true);
    expect(isFinzMentionIntent("position")).toBe(true);
    expect(isFinzMentionIntent("chart")).toBe(true);
    expect(isFinzMentionIntent("briefing")).toBe(true);
    expect(isFinzMentionIntent("qa")).toBe(true);
  });
  it("모르는 값 거절(서버 분류 폴백 안전망)", () => {
    expect(isFinzMentionIntent("raid")).toBe(false);
    expect(isFinzMentionIntent("")).toBe(false);
    expect(isFinzMentionIntent(null)).toBe(false);
    expect(isFinzMentionIntent(undefined)).toBe(false);
    expect(isFinzMentionIntent(123)).toBe(false);
  });
});

describe("normalizeChartSymbol", () => {
  it("정상 심볼은 대문자로 통과", () => {
    expect(normalizeChartSymbol("NASDAQ:TSLA")).toBe("NASDAQ:TSLA");
    expect(normalizeChartSymbol("krx:005930")).toBe("KRX:005930");
    expect(normalizeChartSymbol(" tsla ")).toBe("TSLA");
  });
  it("허용 외 문자 제거(위젯 안전)", () => {
    expect(normalizeChartSymbol("TSLA<script>")).toBe("TSLASCRIPT");
    expect(normalizeChartSymbol("삼성전자")).toBe(null); // 한글만 → 빈값 → null
  });
  it("비문자열/빈값은 null(차트 대신 qa 폴백)", () => {
    expect(normalizeChartSymbol(null)).toBe(null);
    expect(normalizeChartSymbol(undefined)).toBe(null);
    expect(normalizeChartSymbol("")).toBe(null);
    expect(normalizeChartSymbol(123)).toBe(null);
  });
});

describe("splitByMention", () => {
  it("멘션 토큰만 isMention=true 세그먼트로 분해", () => {
    expect(splitByMention("@finz 안녕")).toEqual([
      { text: "@finz", isMention: true },
      { text: " 안녕", isMention: false },
    ]);
    expect(splitByMention("야 @AI 봐줘")).toEqual([
      { text: "야 ", isMention: false },
      { text: "@AI", isMention: true },
      { text: " 봐줘", isMention: false },
    ]);
  });
  it("멘션 없으면 통째로 일반 세그먼트", () => {
    expect(splitByMention("그냥 텍스트")).toEqual([{ text: "그냥 텍스트", isMention: false }]);
    expect(splitByMention("@airline 예약")).toEqual([{ text: "@airline 예약", isMention: false }]);
  });
});

describe("shouldFinzProactivelySpeak", () => {
  it("멤버 텍스트가 threshold(3) 이상 쌓이고 마지막이 멤버 발화면 true", () => {
    expect(shouldFinzProactivelySpeak([text(0, "a"), text(1, "b"), text(2, "a")])).toBe(true);
  });
  it("멤버 텍스트가 모자라면 false", () => {
    expect(shouldFinzProactivelySpeak([text(0, "a"), text(1, "b")])).toBe(false);
    expect(shouldFinzProactivelySpeak([])).toBe(false);
  });
  it("마지막이 finz(또는 비-텍스트)면 false — 멤버 발화 직후에만 끼어든다", () => {
    expect(shouldFinzProactivelySpeak([text(0, "a"), text(1, "b"), text(2, "a"), pick(3)])).toBe(false);
  });
  it("카운트는 마지막 finz 발화 이후만 — 직전 발화 뒤 새로 쌓인 멤버 텍스트 기준", () => {
    expect(shouldFinzProactivelySpeak([pick(0), text(1, "a"), text(2, "b"), text(3, "a")])).toBe(true);
    expect(shouldFinzProactivelySpeak([pick(0), text(1, "a"), text(2, "b")])).toBe(false);
  });
});

describe("isFinzStoredChatMessage", () => {
  const base = { id: "x", authorId: "a", authorName: "지헌", createdAt: "t" };
  it("kind 별 유효 메시지 통과", () => {
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text", text: "hi" })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "system", authorId: "system", kind: "system", text: "joined" })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", authorId: "finz", kind: "pick", payload: PICK })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", authorId: "finz", kind: "summary", payload: SUMMARY })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "position", payload: { stance: "관망", note: "" } })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", authorId: "finz", kind: "chart", payload: { symbol: "NASDAQ:TSLA", label: "테슬라" } })).toBe(true);
  });
  it("모르는 kind / 깨진 페이로드 / 잘못된 stance 거절", () => {
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "wat", text: "x" })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", kind: "pick", payload: { name: "broken" } })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "position", payload: { stance: "사세요", note: "" } })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text" })).toBe(false); // text 누락
    expect(isFinzStoredChatMessage({ ...base, role: "finz", kind: "chart", payload: { symbol: "", label: "x" } })).toBe(false); // 빈 심볼
    expect(isFinzStoredChatMessage({ ...base, role: "finz", kind: "chart", payload: { label: "x" } })).toBe(false); // symbol 누락
    expect(isFinzStoredChatMessage({ ...base, role: "bot", kind: "text", text: "x" })).toBe(false); // 잘못된 role
  });
});
