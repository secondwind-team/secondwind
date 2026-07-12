import { describe, expect, it } from "vitest";
import {
  buildFinzTranscript,
  computeNextNudge,
  isFinzStoredChatMessage,
  mentionsFinz,
  mentionsMember,
  selectLatestPick,
  selectLatestPositionsByMember,
  resolveThreadRootId,
  selectThreadRoots,
  selectThreadMessages,
  threadStats,
  isFinzMentionIntent,
  normalizeChartSymbol,
  shouldFinzProactivelySpeak,
  splitByMention,
  splitByMentionTokens,
  splitMessageBody,
  firstUrlInText,
  stripFinzMention,
  isFinzAttachment,
  isValidAttachmentPathname,
  attachmentSnippet,
  finzMessageSnippet,
  isFinzImageQuality,
  FINZ_DEFAULT_IMAGE_QUALITY,
  FINZ_IMAGE_QUALITY_PRESETS,
  type FinzAttachment,
  type FinzChatMemberLite,
  type FinzChatMessage,
} from "./finz-chat";
import { canListenToFinzMessage, prepareFinzSpeechText } from "./finz-message-listen";
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
// 답글(text + replyTo). id=r{seq}, replyTo.id=parentId. createdAt 은 정렬 비교용으로 seq 를 실어둔다.
function reply(seq: number, authorId: string, parentId: string): FinzChatMessage {
  return {
    id: `r${seq}`, seq, role: "member", authorId, authorName: authorId, kind: "text", text: "re", createdAt: `2026-06-14T00:00:${String(seq).padStart(2, "0")}.000Z`,
    replyTo: { id: parentId, authorName: "x", snippet: "…", kind: "text" },
  };
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

describe("message listen helpers", () => {
  it("120자 이상이고 삭제되지 않은 text 메시지만 듣기 대상으로 고른다", () => {
    const long: FinzChatMessage = { id: "listen-1", seq: 1, role: "member", authorId: "a", authorName: "a", kind: "text", text: "가".repeat(120), createdAt: "t" };
    expect(canListenToFinzMessage(long)).toBe(true);
    expect(canListenToFinzMessage({ ...long, text: "가".repeat(119) })).toBe(false);
    expect(canListenToFinzMessage({ ...long, deletedAt: "t2" })).toBe(false);
    expect(canListenToFinzMessage(pick(2))).toBe(false);
  });

  it("음성 재생용 텍스트만 URL/마크다운/HTML/@finz/이모지를 정리한다", () => {
    const spoken = prepareFinzSpeechText("## @finz **뉴스** <b>요약</b>\nhttps://example.com/a/b 🙂 [자료](https://x.com)");
    expect(spoken).toBe("핀즈 뉴스 요약 링크 자료 링크");
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
  it("내 입장만 있고 상대 미입장이면 nudge 없음(행동 불가한 '대기' 버블은 안 띄움)", () => {
    const n = computeNextNudge([pick(1), position(2, "a")], MEMBERS, "a");
    expect(n).toBeNull();
  });
  it("둘 다 입장 + 요약 없으면 summary", () => {
    const n = computeNextNudge([pick(1), position(2, "a"), position(3, "b")], MEMBERS, "a");
    expect(n?.cta).toBe("summary");
  });
  it("둘 다 입장 + 최신 요약 있으면 null", () => {
    const n = computeNextNudge([pick(1), position(2, "a"), position(3, "b"), summary(4)], MEMBERS, "a");
    expect(n).toBeNull();
  });
  it("모두 입장 직후엔 summary, 이후 대화가 이어지면 null(최하단 영구 고정 방지)", () => {
    const base = [pick(1), position(2, "a"), position(3, "b")];
    // 모두 막 입장을 마친 직후(마지막 메시지 = 그 입장) → summary nudge 1회 노출
    expect(computeNextNudge(base, MEMBERS, "a")?.cta).toBe("summary");
    // 이후 자유 대화(또는 브리핑 등 어떤 메시지)가 오면 '요약 받을까?' 순간은 지났으므로 사라진다
    expect(computeNextNudge([...base, text(4, "a")], MEMBERS, "a")).toBeNull();
    expect(computeNextNudge([...base, text(4, "b"), text(5, "a")], MEMBERS, "a")).toBeNull();
  });
  it("3인 방: 한 명이라도 미입장이면 조기 summary nudge 없음(null), 전원 입장해야 summary", () => {
    const THREE: FinzChatMemberLite[] = [
      ...MEMBERS,
      { memberId: "c", displayName: "민지", selectedCardIds: ["z"], joinedAt: "t" },
    ];
    // a·b 입장, c 미입장 → 행동 불가한 대기 버블 대신 nudge 없음(조기 summary 도 방지).
    const waiting = computeNextNudge([pick(1), position(2, "a"), position(3, "b")], THREE, "a");
    expect(waiting).toBeNull();
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

describe("mentionsMember", () => {
  it("@표시이름을 멘션으로 인식(공백 허용·조사 무관)", () => {
    expect(mentionsMember("@남덕우 이거 봐", "남덕우")).toBe(true);
    expect(mentionsMember("@ 남덕우 봐", "남덕우")).toBe(true);
    expect(mentionsMember("@남덕우야 봐봐", "남덕우")).toBe(true);
  });
  it("멘션이 아니면 false", () => {
    expect(mentionsMember("그냥 대화", "남덕우")).toBe(false);
    expect(mentionsMember("남덕우 봐", "남덕우")).toBe(false); // @ 없으면 멘션 아님
  });
  it("빈 이름은 false", () => {
    expect(mentionsMember("@아무개", "")).toBe(false);
    expect(mentionsMember("@아무개", "   ")).toBe(false);
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

describe("splitByMentionTokens (멤버 멘션 포함)", () => {
  it("멤버 이름(@남덕우)도 멘션으로 분해", () => {
    expect(splitByMentionTokens("@남덕우 안녕", ["남덕우", "지헌"])).toEqual([
      { text: "@남덕우", isMention: true },
      { text: " 안녕", isMention: false },
    ]);
  });
  it("finz 와 멤버 멘션 둘 다", () => {
    const segs = splitByMentionTokens("@finz 랑 @지헌 봐", ["지헌"]);
    expect(segs.filter((s) => s.isMention).map((s) => s.text)).toEqual(["@finz", "@지헌"]);
  });
  it("names 없으면 finz 만(기존과 동일)", () => {
    expect(splitByMentionTokens("@남덕우 안녕", [])).toEqual([{ text: "@남덕우 안녕", isMention: false }]);
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
    expect(isFinzStoredChatMessage({
      ...base,
      role: "member",
      kind: "text",
      text: "hi",
      reactions: { a: "❤️", b: "👍" },
      replyTo: { id: "m1", authorName: "태훈", snippet: "원본", kind: "text" },
      editedAt: "t2",
    })).toBe(true);
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
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text", text: "x", reactions: { a: "🔥" } })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text", text: "x", replyTo: { id: "", snippet: "x" } })).toBe(false);
  });
});

describe("buildFinzTranscript", () => {
  const finzText = (seq: number, t: string): FinzChatMessage => ({
    id: `f${seq}`, seq, role: "finz", authorId: "finz", authorName: "FINZ", kind: "text", text: t, createdAt: "t",
  });
  const memberText = (seq: number, authorId: string, t: string): FinzChatMessage => ({
    id: `m${seq}`, seq, role: "member", authorId, authorName: authorId, kind: "text", text: t, createdAt: "t",
  });

  it("멤버는 displayName, finz 는 'finz' 로 화자를 도출한다", () => {
    const turns = buildFinzTranscript([memberText(1, "a", "안녕"), finzText(2, "반가워")], MEMBERS);
    expect(turns).toEqual([
      { speaker: "지헌", text: "안녕" },
      { speaker: "finz", text: "반가워" },
    ]);
  });

  it("비텍스트 메시지(픽·요약·차트·입장)는 행동 한 줄로 요약한다", () => {
    const chart: FinzChatMessage = {
      id: "c1", seq: 4, role: "finz", authorId: "finz", authorName: "FINZ", kind: "chart",
      payload: { symbol: "NASDAQ:TSLA", label: "테슬라" }, createdAt: "t",
    };
    const turns = buildFinzTranscript([pick(1), position(2, "a", "관망", "지켜볼래"), summary(3), chart], MEMBERS);
    expect(turns).toEqual([
      { speaker: "finz", text: "(우정주 테마 '구독 경제' 를 뽑음)" },
      { speaker: "지헌", text: "(입장) 관망 · 지켜볼래" },
      { speaker: "finz", text: "(파티 요약) s" },
      { speaker: "finz", text: "(테슬라 차트를 보여줌)" },
    ]);
  });

  it("system 메시지는 맥락에서 생략한다", () => {
    const sys: FinzChatMessage = {
      id: "s1", seq: 2, role: "system", authorId: "system", authorName: "", kind: "system", text: "입장했어요", createdAt: "t",
    };
    const turns = buildFinzTranscript([memberText(1, "a", "안녕"), sys, finzText(3, "응")], MEMBERS);
    expect(turns).toEqual([
      { speaker: "지헌", text: "안녕" },
      { speaker: "finz", text: "응" },
    ]);
  });

  it("삭제된 text 는 원문 대신 삭제 안내만 맥락에 넣는다", () => {
    const deleted: FinzChatMessage = {
      id: "d1", seq: 1, role: "member", authorId: "a", authorName: "a", kind: "text", text: "원문", createdAt: "t", deletedAt: "t2",
    };
    expect(buildFinzTranscript([deleted], MEMBERS)).toEqual([{ speaker: "지헌", text: "삭제된 메시지입니다" }]);
  });

  it("최근 maxTurns 발화만 남긴다(기본 8)", () => {
    const msgs = Array.from({ length: 12 }, (_, i) => memberText(i + 1, "a", `m${i + 1}`));
    const turns = buildFinzTranscript(msgs, MEMBERS);
    expect(turns).toHaveLength(8);
    expect(turns[0]?.text).toBe("m5"); // 마지막 8개 → m5..m12
    expect(turns[7]?.text).toBe("m12");
    expect(buildFinzTranscript(msgs, MEMBERS, 3)).toHaveLength(3);
  });

  it("멤버 목록에 없는 authorId 는 '친구' 로 폴백한다", () => {
    const turns = buildFinzTranscript([memberText(1, "unknown", "어")], MEMBERS);
    expect(turns).toEqual([{ speaker: "친구", text: "어" }]);
  });
});

describe("스레드 셀렉터 (replyTo 기반)", () => {
  // t1(원글) ← r2(t1에 답) ← r3(r2에 답, 체인) · t4(다른 원글) · r5(t4에 답)
  const msgs = [text(1, "a"), reply(2, "b", "t1"), reply(3, "a", "r2"), text(4, "b"), reply(5, "a", "t4")];
  const byId = new Map(msgs.map((m) => [m.id, m]));

  it("resolveThreadRootId: 답글 체인을 root 까지 거슬러 올라간다", () => {
    expect(resolveThreadRootId(byId, byId.get("t1")!)).toBe("t1"); // 원글=자기자신
    expect(resolveThreadRootId(byId, byId.get("r2")!)).toBe("t1");
    expect(resolveThreadRootId(byId, byId.get("r3")!)).toBe("t1"); // 체인도 root 로
    expect(resolveThreadRootId(byId, byId.get("r5")!)).toBe("t4");
  });

  it("대상이 창 밖(맵에 없음)이면 그 지점을 root 로(무손실)", () => {
    const orphan = reply(9, "a", "gone");
    expect(resolveThreadRootId(new Map([[orphan.id, orphan]]), orphan)).toBe("r9");
  });

  it("selectThreadRoots: 원글만(답글은 숨김)", () => {
    expect(selectThreadRoots(msgs).map((m) => m.id)).toEqual(["t1", "t4"]);
  });

  it("selectThreadMessages: root + 하위 답글 전부(체인 포함), seq 순", () => {
    expect(selectThreadMessages(msgs, "t1").map((m) => m.id)).toEqual(["t1", "r2", "r3"]);
    expect(selectThreadMessages(msgs, "t4").map((m) => m.id)).toEqual(["t4", "r5"]);
  });

  it("threadStats: root 별 답글 수 + 마지막 답글 seq", () => {
    const stats = threadStats(msgs);
    expect(stats.get("t1")).toMatchObject({ count: 2, lastReplySeq: 3 });
    expect(stats.get("t4")).toMatchObject({ count: 1, lastReplySeq: 5 });
    expect(stats.has("t4-none")).toBe(false);
  });

  it("답글 없는 방(전부 원글) 이면 stats 비고 roots=전체", () => {
    const flat = [text(1, "a"), text(2, "b")];
    expect(threadStats(flat).size).toBe(0);
    expect(selectThreadRoots(flat).map((m) => m.id)).toEqual(["t1", "t2"]);
  });
});

describe("splitMessageBody (평문 URL + 멘션 링크화)", () => {
  const reassemble = (segs: ReturnType<typeof splitMessageBody>) => segs.map((s) => s.text).join("");

  it("URL 이 없으면 텍스트/멘션만(원문 보존)", () => {
    const segs = splitMessageBody("안녕 @finz 오늘 어때", ["지헌"]);
    expect(reassemble(segs)).toBe("안녕 @finz 오늘 어때");
    expect(segs.some((s) => s.type === "mention")).toBe(true);
    expect(segs.some((s) => s.type === "url")).toBe(false);
  });

  it("평문 http(s) URL 을 url 세그먼트로 분리", () => {
    const segs = splitMessageBody("이거 봐 https://example.com/path 좋지", []);
    const url = segs.find((s) => s.type === "url");
    expect(url).toBeDefined();
    expect(url).toMatchObject({ type: "url", href: "https://example.com/path", text: "https://example.com/path" });
    expect(reassemble(segs)).toBe("이거 봐 https://example.com/path 좋지");
  });

  it("URL 뒤 문장부호는 링크에서 제외(재조립 시 원문 유지)", () => {
    const segs = splitMessageBody("확인: https://example.com.", []);
    const url = segs.find((s) => s.type === "url")!;
    expect(url.href).toBe("https://example.com"); // 끝 '.' 제외
    expect(reassemble(segs)).toBe("확인: https://example.com."); // 원문은 그대로
  });

  it("괄호로 감싼 URL 은 끝 ')' 를 링크에서 제외", () => {
    const segs = splitMessageBody("(링크: https://example.com)", []);
    const url = segs.find((s) => s.type === "url")!;
    expect(url.href).toBe("https://example.com");
  });

  it("URL 안의 균형 잡힌 괄호는 유지(위키백과류)", () => {
    const segs = splitMessageBody("https://en.wikipedia.org/wiki/Foo_(bar) 참고", []);
    const url = segs.find((s) => s.type === "url")!;
    expect(url.href).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("URL 안의 @ 는 멘션으로 오인하지 않는다", () => {
    const segs = splitMessageBody("https://x.com/@finz 확인", []);
    const mentions = segs.filter((s) => s.type === "mention");
    expect(mentions).toHaveLength(0);
    expect(segs.find((s) => s.type === "url")!.href).toBe("https://x.com/@finz");
  });

  it("여러 URL 을 모두 분리", () => {
    const segs = splitMessageBody("http://a.com 와 https://b.com/c", []);
    expect(segs.filter((s) => s.type === "url").map((s) => s.text)).toEqual(["http://a.com", "https://b.com/c"]);
  });
});

describe("firstUrlInText", () => {
  it("첫 URL 을 반환(문장부호 제외)", () => {
    expect(firstUrlInText("보자 https://example.com/a, 그리고 http://b.com")).toBe("https://example.com/a");
  });
  it("마크다운 링크 안의 href 도 추출(끝 ')' 제외)", () => {
    expect(firstUrlInText("[여기](https://example.com/x) 클릭")).toBe("https://example.com/x");
  });
  it("URL 없으면 null", () => {
    expect(firstUrlInText("그냥 텍스트 @finz")).toBeNull();
  });
});

describe("이미지 화질(imageQuality)", () => {
  it("isFinzImageQuality: 3개 값만 통과", () => {
    expect(isFinzImageQuality("original")).toBe(true);
    expect(isFinzImageQuality("standard")).toBe(true);
    expect(isFinzImageQuality("saver")).toBe(true);
    expect(isFinzImageQuality("high")).toBe(false);
    expect(isFinzImageQuality(undefined)).toBe(false);
  });
  it("기본값은 standard, 프리셋 긴 변은 1600/1024", () => {
    expect(FINZ_DEFAULT_IMAGE_QUALITY).toBe("standard");
    expect(FINZ_IMAGE_QUALITY_PRESETS.standard.maxLongSide).toBe(1600);
    expect(FINZ_IMAGE_QUALITY_PRESETS.saver.maxLongSide).toBe(1024);
  });
});

describe("첨부(attachments)", () => {
  const img: FinzAttachment = {
    kind: "image",
    pathname: "finz/a-x7f.jpg",
    name: "a.jpg",
    size: 1234,
    contentType: "image/jpeg",
  };
  const file: FinzAttachment = {
    kind: "file",
    pathname: "finz/doc-q1.pdf",
    name: "doc.pdf",
    size: 5000,
    contentType: "application/pdf",
  };

  it("isFinzAttachment: 유효/무효 판정", () => {
    expect(isFinzAttachment(img)).toBe(true);
    expect(isFinzAttachment(file)).toBe(true);
    expect(isFinzAttachment({ ...img, kind: "video" })).toBe(false); // 허용 안 되는 kind
    expect(isFinzAttachment({ ...img, pathname: "https://evil.com/a.jpg" })).toBe(false); // URL/스킴 금지(SSRF 방어)
    expect(isFinzAttachment({ ...img, pathname: "" })).toBe(false); // 빈 pathname
    expect(isFinzAttachment({ ...img, size: -1 })).toBe(false);
    expect(isFinzAttachment({ ...img, size: "big" })).toBe(false);
    expect(isFinzAttachment(null)).toBe(false);
  });

  it("isValidAttachmentPathname: bare path 만 허용(URL/스킴 거절 — SSRF 방어)", () => {
    expect(isValidAttachmentPathname("finz/a-x7f.jpg")).toBe(true);
    expect(isValidAttachmentPathname("a.png")).toBe(true);
    expect(isValidAttachmentPathname("https://evil.com/x")).toBe(false);
    expect(isValidAttachmentPathname("http://169.254.169.254/latest")).toBe(false);
    expect(isValidAttachmentPathname("ftp://x/y")).toBe(false);
    expect(isValidAttachmentPathname("")).toBe(false);
    expect(isValidAttachmentPathname(42)).toBe(false);
  });

  it("attachmentSnippet: 이미지/파일/혼합 요약", () => {
    expect(attachmentSnippet([img])).toBe("📷 사진");
    expect(attachmentSnippet([img, img])).toBe("📷 사진 2장");
    expect(attachmentSnippet([file])).toBe("📎 doc.pdf");
    expect(attachmentSnippet([img, file])).toBe("📎 첨부 2개");
    expect(attachmentSnippet([])).toBe("");
  });

  it("finzMessageSnippet: 캡션 없는 첨부 메시지는 첨부를 요약", () => {
    const withCaption = { kind: "text", text: "이거 봐", attachments: [img] } as unknown as FinzChatMessage;
    const noCaption = { kind: "text", text: "   ", attachments: [img, img] } as unknown as FinzChatMessage;
    expect(finzMessageSnippet(withCaption)).toBe("이거 봐");
    expect(finzMessageSnippet(noCaption)).toBe("📷 사진 2장");
  });
});
