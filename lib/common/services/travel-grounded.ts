import type { PlaceInfo, TravelInput, TravelPlan } from "./travel";
import { kakaoMapSearchUrl } from "./travel";
import { searchPlaceCandidates } from "./travel-enrich";

// 시드 1개당 풀에 들어가는 후보 수. 너무 크면 풀이 비대해지고 LLM 컨텍스트도 늘어남.
const PER_SEED_LIMIT = 5;
// 시드 자체의 상한. 풀 수집은 Naver 호출 = 시드 수와 비례.
const MAX_SEEDS = 10;
// 풀 자체의 상한. 단일 LLM 호출에 첨부할 라인 수.
const MAX_POOL_SIZE = 35;

export type PoolEntry = {
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  url?: string;
  lat?: number;
  lng?: number;
  /** 어떤 시드에서 왔는지 — 디버깅·snapshot 용 */
  seedTag: string;
};

const DEFAULT_DESTINATION_SEEDS: ReadonlyArray<string> = ["관광지", "맛집", "카페"];

// 도시별 추가 시드. 일반 카테고리만으로 부족한 키워드를 보강.
const DESTINATION_EXTRA_SEEDS: Record<string, ReadonlyArray<string>> = {
  제주: ["오름", "해변", "흑돼지 맛집"],
  서귀포: ["오름", "해변", "흑돼지 맛집"],
  부산: ["해변", "야경 명소", "회 맛집", "돼지국밥 맛집"],
  강릉: ["해변", "커피거리", "물회 맛집"],
  속초: ["해변", "물회 맛집"],
  여수: ["해변", "야경 명소", "회 맛집"],
  통영: ["해산물 맛집", "야경 명소"],
  경주: ["문화재", "한옥 카페"],
  전주: ["한옥마을", "비빔밥 맛집"],
  서울: ["전망 명소", "한옥마을", "고궁"],
  인천: ["해변", "차이나타운"],
  포항: ["해변", "회 맛집"],
};

// 페르소나 힌트: 사용자 프롬프트에서 동행자 정보를 인지해 풀에 카테고리 추가.
const PERSONA_PATTERNS: Array<{ test: RegExp; addSeeds: ReadonlyArray<string> }> = [
  {
    test: /(아이|어린이|유아|어린|초등|키즈|영유아|\b(?:[1-9]|1[0-2])\s*세\b)/,
    addSeeds: ["키즈카페", "아이 동반 식당", "체험 박물관"],
  },
  {
    test: /(부모|어머니|아버지|어르신|시부모|장인|장모)/,
    addSeeds: ["전망 식당", "한정식 맛집"],
  },
  {
    test: /(반려|강아지|애견|댕댕이|펫|반려견)/,
    addSeeds: ["반려동물 동반 카페", "애견 동반 식당"],
  },
  {
    test: /(데이트|커플|기념일|프로포즈|허니문|신혼)/,
    addSeeds: ["야경 명소", "분위기 좋은 식당"],
  },
];

// 음식·활동 키워드: 프롬프트에서 발견되면 그대로 시드로 사용.
const FOOD_KEYWORDS: ReadonlyArray<string> = [
  "회",
  "초밥",
  "돼지국밥",
  "흑돼지",
  "고기국수",
  "물회",
  "한정식",
  "비빔밥",
  "냉면",
  "갈비",
  "삼겹살",
  "막국수",
  "닭갈비",
  "해산물",
  "조개구이",
  "전복",
  "성게",
  "보쌈",
  "족발",
  "국밥",
];

const ACTIVITY_KEYWORDS: Array<{ test: RegExp; seed: string }> = [
  { test: /(전시|미술관|갤러리)/, seed: "미술관" },
  { test: /(박물관)/, seed: "박물관" },
  { test: /(서점|책방)/, seed: "독립서점" },
  { test: /(시장|재래시장)/, seed: "전통시장" },
  { test: /(온천|스파|찜질)/, seed: "온천" },
  { test: /(트레킹|등산|둘레길)/, seed: "트레킹 코스" },
];

export function extractSeeds(input: TravelInput): string[] {
  const seeds = new Set<string>();

  for (const seed of DEFAULT_DESTINATION_SEEDS) seeds.add(seed);

  const destKey = normalizeDestKey(input.destination);
  const extras = DESTINATION_EXTRA_SEEDS[destKey];
  if (extras) extras.forEach((seed) => seeds.add(seed));

  const promptText = input.prompt;
  if (promptText) {
    for (const persona of PERSONA_PATTERNS) {
      if (persona.test.test(promptText)) {
        persona.addSeeds.forEach((seed) => seeds.add(seed));
      }
    }
    for (const food of FOOD_KEYWORDS) {
      if (promptText.includes(food)) {
        seeds.add(`${food} 맛집`);
      }
    }
    for (const activity of ACTIVITY_KEYWORDS) {
      if (activity.test.test(promptText)) {
        seeds.add(activity.seed);
      }
    }
  }

  return Array.from(seeds).slice(0, MAX_SEEDS);
}

function normalizeDestKey(destination: string): string {
  return destination.trim().split(/\s+/)[0] ?? destination.trim();
}

export async function collectPoolFromSeeds(
  seeds: ReadonlyArray<string>,
  destination: string,
): Promise<PoolEntry[]> {
  if (seeds.length === 0) return [];

  // 같은 이름의 장소가 여러 시드에서 나오는 게 자연스러움 (예: "맛집" 과 "회 맛집" 둘 다에서 동일 식당).
  // 이름 기준 dedupe 하고, 먼저 등록된 seedTag 를 유지.
  const byName = new Map<string, PoolEntry>();

  const tasks = seeds.map(async (seed) => {
    const candidates = await searchPlaceCandidates(seed, destination, PER_SEED_LIMIT);
    return { seed, candidates };
  });

  const results = await Promise.all(tasks);

  for (const { seed, candidates } of results) {
    for (const candidate of candidates) {
      if (!candidate.name) continue;
      if (byName.has(candidate.name)) continue;
      const entry: PoolEntry = {
        name: candidate.name,
        seedTag: seed,
        ...(candidate.category ? { category: candidate.category } : {}),
        ...(candidate.address ? { address: candidate.address } : {}),
        ...(candidate.phone ? { phone: candidate.phone } : {}),
        ...(candidate.url ? { url: candidate.url } : {}),
        ...(typeof candidate.lat === "number" ? { lat: candidate.lat } : {}),
        ...(typeof candidate.lng === "number" ? { lng: candidate.lng } : {}),
      };
      byName.set(candidate.name, entry);
    }
  }

  return Array.from(byName.values()).slice(0, MAX_POOL_SIZE);
}

export function appendPoolToPrompt(userPrompt: string, pool: ReadonlyArray<PoolEntry>): string {
  if (pool.length === 0) return userPrompt;
  const lines = pool.map((entry, index) => {
    const meta = [entry.category, entry.address].filter((v) => Boolean(v)).join(" · ");
    return `[${index + 1}] ${entry.name}${meta ? ` (${meta})` : ""}`;
  });
  return [
    userPrompt,
    "",
    "[후보 풀]",
    ...lines,
    "",
    "위 풀의 name 과 정확히 같은 문자열만 place_query 로 사용. 풀에 없는 장소는 place_query 를 빈 문자열로 두고 활동 설명만 작성.",
  ].join("\n");
}

export function buildPoolMap(pool: ReadonlyArray<PoolEntry>): Map<string, PoolEntry> {
  const map = new Map<string, PoolEntry>();
  for (const entry of pool) {
    map.set(entry.name, entry);
  }
  return map;
}

/**
 * 후보 풀에 있는 place_query 만 PlaceInfo 로 채우고, 풀 밖은 빈 문자열로 정리.
 * Naver 재호출 없이 풀에서 직접 좌표·주소·카테고리를 읽어 옴.
 * 사용자가 명시한 숙소(plan.stay) 는 풀과 무관하게 보존.
 */
export function applyPoolToPlan(plan: TravelPlan, poolMap: Map<string, PoolEntry>): void {
  for (const day of plan.days) {
    for (const item of day.items) {
      const query = item.place_query?.trim();
      if (!query) {
        item.place_query = "";
        item.place = undefined;
        item.place_warning = undefined;
        continue;
      }
      const entry = poolMap.get(query);
      if (!entry) {
        item.place_query = "";
        item.place = undefined;
        item.place_warning = undefined;
        continue;
      }
      item.place = poolEntryToPlaceInfo(entry);
      item.place_warning = undefined;
    }
  }
}

function poolEntryToPlaceInfo(entry: PoolEntry): PlaceInfo {
  const info: PlaceInfo = { name: entry.name, url: kakaoMapSearchUrl(entry.name) };
  if (entry.category) info.category = entry.category;
  if (entry.address) info.address = entry.address;
  if (entry.phone) info.phone = entry.phone;
  if (typeof entry.lat === "number") info.lat = entry.lat;
  if (typeof entry.lng === "number") info.lng = entry.lng;
  return info;
}
