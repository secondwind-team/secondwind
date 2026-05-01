import { describe, expect, it } from "vitest";
import { prependMustVisitToPool, type PoolEntry } from "./travel-grounded";
import type { MustVisitItem } from "./travel";

describe("prependMustVisitToPool", () => {
  const seedPool: PoolEntry[] = [
    { name: "성산일출봉", seedTag: "관광지", category: "관광명소" },
    { name: "카페 델문도", seedTag: "카페", address: "제주 조천읍" },
  ];

  it("mustVisit 없으면 원본 풀 복사본 반환", () => {
    const out = prependMustVisitToPool(seedPool, undefined);
    expect(out).toEqual(seedPool);
    expect(out).not.toBe(seedPool); // 새 배열
  });

  it("mustVisit 빈 배열도 원본 그대로", () => {
    const out = prependMustVisitToPool(seedPool, []);
    expect(out).toEqual(seedPool);
  });

  it("resolved mustVisit 만 풀의 앞쪽에 우선 삽입", () => {
    const mv: MustVisitItem[] = [
      {
        name: "흑돈가 성산점",
        place: { name: "흑돈가 성산점", lat: 33.45, lng: 126.92, address: "제주 ..." },
      },
      { name: "텍스트만" }, // unresolved → skip
    ];
    const out = prependMustVisitToPool(seedPool, mv);
    expect(out[0]?.name).toBe("흑돈가 성산점");
    expect(out[0]?.seedTag).toBe("mustVisit");
    expect(out[0]?.lat).toBe(33.45);
    expect(out[1]?.name).toBe("성산일출봉");
    expect(out[2]?.name).toBe("카페 델문도");
    expect(out).toHaveLength(3);
  });

  it("mustVisit 의 place.name 이 풀에 이미 있으면 풀 항목 제거 (앞쪽 mustVisit 우선)", () => {
    const mv: MustVisitItem[] = [
      {
        name: "성산일출봉",
        place: { name: "성산일출봉", lat: 33.45, lng: 126.94, address: "제주 ..." },
      },
    ];
    const out = prependMustVisitToPool(seedPool, mv);
    expect(out[0]?.name).toBe("성산일출봉");
    expect(out[0]?.seedTag).toBe("mustVisit");
    expect(out[0]?.lat).toBe(33.45); // mustVisit 의 좌표
    // 풀에 같은 이름이 또 있으면 안 됨 (dedup)
    const occurrences = out.filter((entry) => entry.name === "성산일출봉").length;
    expect(occurrences).toBe(1);
  });

  it("place.name 없는 resolved mustVisit 은 skip", () => {
    const mv: MustVisitItem[] = [
      { name: "이름표만 있음", place: { lat: 33.45, lng: 126.92 } },
    ];
    const out = prependMustVisitToPool(seedPool, mv);
    expect(out).toEqual(seedPool);
  });
});
