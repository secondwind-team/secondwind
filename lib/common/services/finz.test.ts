import { describe, expect, it } from "vitest";
import {
  buildFinzFallbackPick,
  buildFinzProfile,
  getSelectedTasteCards,
  isFinzDailyPick,
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
