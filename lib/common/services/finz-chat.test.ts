import { describe, expect, it } from "vitest";
import {
  computeNextNudge,
  isFinzStoredChatMessage,
  selectLatestPick,
  selectLatestPositionsByMember,
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
});

describe("isFinzStoredChatMessage", () => {
  const base = { id: "x", authorId: "a", authorName: "지헌", createdAt: "t" };
  it("kind 별 유효 메시지 통과", () => {
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text", text: "hi" })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "system", authorId: "system", kind: "system", text: "joined" })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", authorId: "finz", kind: "pick", payload: PICK })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", authorId: "finz", kind: "summary", payload: SUMMARY })).toBe(true);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "position", payload: { stance: "관망", note: "" } })).toBe(true);
  });
  it("모르는 kind / 깨진 페이로드 / 잘못된 stance 거절", () => {
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "wat", text: "x" })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "finz", kind: "pick", payload: { name: "broken" } })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "position", payload: { stance: "사세요", note: "" } })).toBe(false);
    expect(isFinzStoredChatMessage({ ...base, role: "member", kind: "text" })).toBe(false); // text 누락
    expect(isFinzStoredChatMessage({ ...base, role: "bot", kind: "text", text: "x" })).toBe(false); // 잘못된 role
  });
});
