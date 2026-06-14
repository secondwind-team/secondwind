import { describe, expect, it } from "vitest";
import {
  MAX_MEMBERS,
  applyJoinToGroup,
  buildFinzGroupMember,
  isFinzGroupId,
  isFinzGroupMember,
  parseGroup,
  type FinzGroup,
  type FinzGroupMember,
} from "./finz-group-store";

const CARDS = ["durable-company", "daily-brand", "cashflow-calm"];

function member(memberId: string, name = "테스터"): FinzGroupMember {
  const m = buildFinzGroupMember({ memberId, displayName: name, selectedCardIds: CARDS, joinedAt: "2026-06-14T00:00:00.000Z" });
  if (!m) throw new Error("멤버 빌드 실패");
  return m;
}

function group(members: FinzGroupMember[]): FinzGroup {
  return {
    id: "abc123",
    members,
    createdAt: "2026-06-14T00:00:00.000Z",
    expiresAt: "2026-06-21T00:00:00.000Z",
  };
}

describe("isFinzGroupId", () => {
  it("6자 base62 만 통과", () => {
    expect(isFinzGroupId("abc123")).toBe(true);
    expect(isFinzGroupId("ABCxyz")).toBe(true);
  });
  it("길이·문자 위반 거절", () => {
    expect(isFinzGroupId("abc12")).toBe(false);
    expect(isFinzGroupId("abc1234")).toBe(false);
    expect(isFinzGroupId("abc-12")).toBe(false);
  });
});

describe("buildFinzGroupMember", () => {
  it("카드 3개 이상이면 최소 blob 을 만든다 (캐릭터는 저장 안 함)", () => {
    const m = buildFinzGroupMember({ memberId: "m1", displayName: "지헌", selectedCardIds: CARDS });
    expect(m).not.toBeNull();
    expect(m!.memberId).toBe("m1");
    expect(m!.displayName).toBe("지헌");
    expect(m!.selectedCardIds).toEqual(CARDS);
    expect(m as unknown as Record<string, unknown>).not.toHaveProperty("character");
  });
  it("카드 3개 미만이면 null", () => {
    expect(buildFinzGroupMember({ memberId: "m1", selectedCardIds: ["durable-company"] })).toBeNull();
  });
  it("memberId 가 비면 null", () => {
    expect(buildFinzGroupMember({ memberId: "  ", selectedCardIds: CARDS })).toBeNull();
  });
  it("이름이 비면 캐릭터 클래스명으로 대체", () => {
    const m = buildFinzGroupMember({ memberId: "m1", displayName: "  ", selectedCardIds: CARDS });
    expect(m!.displayName.length).toBeGreaterThan(0);
  });
  it("긴 이름은 24자로 자른다", () => {
    const long = "가".repeat(50);
    const m = buildFinzGroupMember({ memberId: "m1", displayName: long, selectedCardIds: CARDS });
    expect(m!.displayName.length).toBe(24);
  });
});

describe("applyJoinToGroup", () => {
  it("빈 슬롯이 있으면 멤버를 추가하고 ok", () => {
    const r = applyJoinToGroup(group([member("a")]), member("b"));
    expect(r.status).toBe("ok");
    expect(r.group.members).toHaveLength(2);
  });
  it("이미 같은 memberId 면 already-member (중복 추가 안 함, 멱등)", () => {
    const r = applyJoinToGroup(group([member("a")]), member("a"));
    expect(r.status).toBe("already-member");
    expect(r.group.members).toHaveLength(1);
  });
  it("정원(2) 이 차면 full", () => {
    const r = applyJoinToGroup(group([member("a"), member("b")]), member("c"));
    expect(r.status).toBe("full");
    expect(r.group.members).toHaveLength(MAX_MEMBERS);
  });
});

describe("parseGroup", () => {
  it("유효한 blob(문자열·객체 모두) 파싱", () => {
    const g = group([member("a")]);
    expect(parseGroup(JSON.stringify(g))?.id).toBe("abc123");
    expect(parseGroup(g)?.members).toHaveLength(1);
  });
  it("잘못된 id / 멤버 0개 / 정원 초과 / 깨진 타임스탬프 거절", () => {
    expect(parseGroup({ ...group([member("a")]), id: "bad" })).toBeNull();
    expect(parseGroup({ ...group([]) })).toBeNull();
    expect(parseGroup({ ...group([member("a"), member("b"), member("c")]) })).toBeNull();
    expect(parseGroup({ ...group([member("a")]), createdAt: "nope" })).toBeNull();
  });
  it("null / 비객체 거절", () => {
    expect(parseGroup(null)).toBeNull();
    expect(parseGroup("not json")).toBeNull();
  });
});

describe("isFinzGroupMember", () => {
  it("정상 멤버 통과, selectedCardIds 비면 거절", () => {
    expect(isFinzGroupMember(member("a"))).toBe(true);
    expect(isFinzGroupMember({ memberId: "a", displayName: "x", selectedCardIds: [], joinedAt: "t" })).toBe(false);
  });
});

describe("parseGroup — pick 관용 처리 (MVP-04)", () => {
  const VALID_PICK = {
    name: "구독 경제",
    kind: "theme",
    oneLine: "y",
    whyThisParty: ["a"],
    rolePrompts: [
      { memberName: "A", role: "r", prompt: "p" },
      { memberName: "B", role: "r", prompt: "p" },
    ],
    debatePoint: "d",
    openingQuestions: ["q"],
    conversationSeeds: ["s"],
    caveats: ["투자 조언이 아니라 대화 소재"],
  };

  it("유효한 pick 은 round-trip 으로 보존", () => {
    const g = { ...group([member("a"), member("b")]), pick: VALID_PICK };
    expect(parseGroup(g)?.pick?.name).toBe("구독 경제");
  });
  it("깨진 pick 은 드롭하되 파티(멤버)는 유지", () => {
    const g = { ...group([member("a"), member("b")]), pick: { name: "broken" } };
    const parsed = parseGroup(g);
    expect(parsed).not.toBeNull();
    expect(parsed?.pick).toBeUndefined();
    expect(parsed?.members).toHaveLength(2);
  });
  it("pick 없는 그룹도 그대로 파싱", () => {
    expect(parseGroup(group([member("a")]))?.pick).toBeUndefined();
  });
});
