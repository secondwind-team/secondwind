import { describe, expect, it } from "vitest";
import {
  getSelectedTasteCards,
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
