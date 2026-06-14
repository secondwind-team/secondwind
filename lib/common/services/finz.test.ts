import { describe, expect, it } from "vitest";
import {
  buildFinzFallbackPick,
  buildFinzPartyFallbackPick,
  buildFinzProfile,
  getSelectedTasteCards,
  isFinzDailyPick,
  isFinzPartyPick,
  summarizeTasteTags,
  summonFinzCharacter,
} from "./finz";

describe("summonFinzCharacter", () => {
  it("기술과 성장 취향은 미래기술 딜러로 소환", () => {
    const character = summonFinzCharacter([
      "world-changing-tech",
      "big-upside",
      "product-events",
    ]);

    expect(character?.classId).toBe("future-tech-dealer");
  });

  it("현금흐름과 배당 취향은 배당 힐러로 소환", () => {
    const character = summonFinzCharacter([
      "cashflow-calm",
      "steady-dividend",
      "durable-company",
    ]);

    expect(character?.classId).toBe("dividend-healer");
  });

  it("3개 미만 선택이면 소환하지 않음", () => {
    expect(summonFinzCharacter(["world-changing-tech", "big-upside"])).toBeNull();
  });
});

describe("summarizeTasteTags", () => {
  it("선택 카드 태그를 빈도순으로 요약", () => {
    const cards = getSelectedTasteCards([
      "daily-brand",
      "service-habit",
      "friend-adoption",
    ]);

    expect(summarizeTasteTags(cards, 3)).toEqual(["consumer", "brand", "quality"]);
  });
});

describe("buildFinzFallbackPick", () => {
  it("프로필로 만든 폴백 픽이 isFinzDailyPick 을 통과하고 theme 다", () => {
    const profile = buildFinzProfile(["durable-company", "daily-brand", "cashflow-calm"]);
    if (!profile) throw new Error("프로필 생성 실패");

    const pick = buildFinzFallbackPick(profile);

    expect(isFinzDailyPick(pick)).toBe(true);
    expect(pick.kind).toBe("theme");
    expect(pick.openingQuestions.length).toBeGreaterThanOrEqual(2);
    expect(pick.caveats.some((c) => c.includes("대화 소재"))).toBe(true);
  });

  it("알 수 없는 클래스도 default 테마로 유효한 픽을 만든다", () => {
    const pick = buildFinzFallbackPick({
      character: {
        classId: "unknown-class",
        className: "테스트 캐릭터",
        levelTitle: "Lv.1",
        summary: "",
        stats: { attack: 0, defense: 0, patience: 0, research: 0, fomoRisk: 0 },
        weakness: "",
        tease: "",
        roleMission: "관점을 나눠보세요.",
      },
      selectedTags: [],
    });

    expect(isFinzDailyPick(pick)).toBe(true);
    expect(pick.kind).toBe("theme");
  });
});

describe("isFinzPartyPick", () => {
  const valid = {
    name: "구독 경제",
    kind: "theme",
    oneLine: "두 사람이 가볍게 이야기할 소재",
    whyThisParty: ["a", "b"],
    rolePrompts: [
      { memberName: "지헌", role: "밈 버서커", prompt: "p" },
      { memberName: "태훈", role: "매크로 마법사", prompt: "q" },
    ],
    debatePoint: "d",
    openingQuestions: ["q1"],
    conversationSeeds: ["s1"],
    caveats: ["투자 조언이 아니라 대화 소재"],
  };

  it("유효한 파티 픽 통과", () => {
    expect(isFinzPartyPick(valid)).toBe(true);
  });
  it("rolePrompts 가 비면 거절", () => {
    expect(isFinzPartyPick({ ...valid, rolePrompts: [] })).toBe(false);
  });
  it("rolePrompts 항목에 필드가 빠지면 거절", () => {
    expect(isFinzPartyPick({ ...valid, rolePrompts: [{ memberName: "A", role: "x" }] })).toBe(false);
  });
  it("whyThisParty 에 비문자열이 있으면 거절", () => {
    expect(isFinzPartyPick({ ...valid, whyThisParty: [1] })).toBe(false);
  });
});

describe("buildFinzPartyFallbackPick", () => {
  function prof(cards: string[]) {
    const p = buildFinzProfile(cards);
    if (!p) throw new Error("프로필 생성 실패");
    return p;
  }

  it("두 멤버 → theme, rolePrompts 2개(이름·클래스·roleMission), isFinzPartyPick 통과", () => {
    const a = prof(["world-changing-tech", "big-upside", "product-events"]);
    const b = prof(["cashflow-calm", "steady-dividend", "durable-company"]);
    const pick = buildFinzPartyFallbackPick([
      { name: "지헌", profile: a },
      { name: "태훈", profile: b },
    ]);

    expect(pick.kind).toBe("theme");
    expect(pick.rolePrompts).toHaveLength(2);
    const rp0 = pick.rolePrompts[0];
    if (!rp0) throw new Error("rolePrompt 없음");
    expect(rp0.memberName).toBe("지헌");
    expect(rp0.role).toBe(a.character.className);
    expect(rp0.prompt).toBe(a.character.roleMission);
    expect(isFinzPartyPick(pick)).toBe(true);
    expect(pick.caveats.some((c) => c.includes("대화 소재"))).toBe(true);
  });

  it("한 멤버 profile 이 null(카탈로그 드리프트)이어도 유효한 픽", () => {
    const a = prof(["world-changing-tech", "big-upside", "product-events"]);
    const pick = buildFinzPartyFallbackPick([
      { name: "지헌", profile: a },
      { name: "태훈", profile: null },
    ]);

    expect(isFinzPartyPick(pick)).toBe(true);
    expect(pick.rolePrompts).toHaveLength(2);
    const rp1 = pick.rolePrompts[1];
    if (!rp1) throw new Error("rolePrompt 없음");
    expect(rp1.memberName).toBe("태훈");
  });
});
