import { describe, expect, it } from "vitest";
import {
  MAX_MEMBERS,
  MAX_ROOM_MEMBERS,
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
    kind: members.length > 2 ? "group" : "1on1",
    title: "",
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
  it("잘못된 id / 멤버 0개 / 방 정원 초과 / 깨진 타임스탬프 거절", () => {
    expect(parseGroup({ ...group([member("a")]), id: "bad" })).toBeNull();
    expect(parseGroup({ ...group([]) })).toBeNull();
    // 그룹방 정원(12) 초과 = 13명이면 거절. 3명은 이제 유효(그룹방).
    const tooMany = Array.from({ length: MAX_ROOM_MEMBERS + 1 }, (_, i) => member(`m${i}`));
    expect(parseGroup({ ...group(tooMany) })).toBeNull();
    expect(parseGroup({ ...group([member("a"), member("b"), member("c")]) })?.members).toHaveLength(3);
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

describe("parseGroup — 레거시 필드 무시 (채팅 LIST 이전)", () => {
  it("옛 blob 의 pick/positions/summary 가 있어도 거절하지 않고 신원만 뽑는다", () => {
    const legacy = {
      ...group([member("a"), member("b")]),
      pick: { name: "구독 경제", kind: "theme" },
      positions: [{ memberId: "a", stance: "매력 있음", note: "", createdAt: "t" }],
      summary: { summary: "s", nextNudge: "n" },
    };
    const parsed = parseGroup(legacy) as (FinzGroup & Record<string, unknown>) | null;
    expect(parsed).not.toBeNull();
    expect(parsed?.members).toHaveLength(2);
    // 신원 전용 — 대화 필드는 더 이상 그룹에 실리지 않는다.
    expect(parsed?.pick).toBeUndefined();
    expect(parsed?.positions).toBeUndefined();
    expect(parsed?.summary).toBeUndefined();
  });
});
