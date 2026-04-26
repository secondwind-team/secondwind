import { env, assertServerEnv } from "@/lib/common/env";
import {
  kakaoMapSearchUrl,
  type PlaceInfo,
  type PlaceStats,
  type TravelItem,
  type TravelPlan,
} from "./travel";

const NAVER_URL = "https://openapi.naver.com/v1/search/local.json";
const PER_CALL_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 300;
const DAY_OUTLIER_THRESHOLD_KM = 120;

type NaverLocalItem = {
  title?: string;
  category?: string;
  telephone?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
  link?: string;
};

type PlaceLookupResult =
  | { status: "ok"; place: PlaceInfo }
  | { status: "rejected"; warning: string };

const DESTINATION_ALIASES: Record<string, string[]> = {
  가평: ["가평", "경기"],
  강릉: ["강릉", "강원"],
  강원: ["강원"],
  경주: ["경주", "경북"],
  광주: ["광주"],
  대구: ["대구"],
  대전: ["대전"],
  부산: ["부산"],
  서울: ["서울"],
  속초: ["속초", "강원"],
  수원: ["수원", "경기"],
  여수: ["여수", "전남"],
  울산: ["울산"],
  인천: ["인천"],
  전주: ["전주", "전북"],
  제주: ["제주"],
  춘천: ["춘천", "강원"],
  통영: ["통영", "경남"],
  포항: ["포항", "경북"],
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

const MIN_SCORE = 0.25;

function bigrams(s: string): Set<string> {
  const normalized = s.toLowerCase().replace(/\s+/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    grams.add(normalized.slice(i, i + 2));
  }
  return grams;
}

// character-level bigram Jaccard — "월정리해변" ↔ "월정리해수욕장" 같은 유사명 잡음
function overlapScore(query: string, candidate: string): number {
  const a = bigrams(query);
  const b = bigrams(candidate);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function pickBest(query: string, items: NaverLocalItem[]): NaverLocalItem | undefined {
  if (items.length === 0) return undefined;
  let best: NaverLocalItem | undefined;
  let bestTitle = "";
  let bestScore = -1;
  for (const it of items) {
    if (!it) continue;
    const title = stripHtml(it.title ?? "");
    const s = overlapScore(query, title);
    // 점수가 높거나, 동률이면 짧은 제목 우선 (본체 > 분점·체인)
    if (s > bestScore || (s === bestScore && title.length < bestTitle.length)) {
      bestScore = s;
      bestTitle = title;
      best = it;
    }
  }
  // 너무 약한 매칭은 차라리 enrich 안 함 (엉뚱한 매칭 방지)
  if (bestScore < MIN_SCORE) return undefined;
  return best;
}

function toPlaceInfo(item: NaverLocalItem, fallbackQuery: string): PlaceInfo {
  const info: PlaceInfo = {};
  if (item.title) info.name = stripHtml(item.title);
  const address = item.roadAddress || item.address;
  if (address) info.address = address;
  if (item.telephone) info.phone = item.telephone;
  if (item.category) info.category = item.category;

  const lng = item.mapx ? Number(item.mapx) / 1e7 : NaN;
  const lat = item.mapy ? Number(item.mapy) / 1e7 : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    info.lat = lat;
    info.lng = lng;
  }

  info.url = kakaoMapSearchUrl(info.name ?? fallbackQuery);
  return info;
}

function buildSearchQuery(query: string, destHint?: string): string {
  if (!destHint) return query;
  const lower = query.toLowerCase();
  if (lower.includes(destHint.toLowerCase())) return query;
  return `${destHint} ${query}`;
}

// scoring 용 query — destination hint 는 제외 (검색 boost 용이지 매칭 기준 아님)
function buildScoreQuery(query: string, destHint?: string): string {
  if (!destHint) return query;
  const stripped = query.split(destHint).join(" ").replace(/\s+/g, " ").trim();
  return stripped || query;
}

function destinationAliases(destHint?: string): string[] {
  if (!destHint) return [];
  const normalizedHint = normalizeText(destHint);
  const aliases = new Set<string>();
  aliases.add(destHint);

  for (const [key, values] of Object.entries(DESTINATION_ALIASES)) {
    const normalizedKey = normalizeText(key);
    if (normalizedHint.includes(normalizedKey) || normalizedKey.includes(normalizedHint)) {
      values.forEach((v) => aliases.add(v));
    }
  }

  return Array.from(aliases).filter((v) => v.trim().length > 0);
}

function addressMatchesDestination(address: string | undefined, destHint?: string): boolean {
  if (!address || !destHint) return true;
  const normalizedAddress = normalizeText(address);
  const aliases = destinationAliases(destHint);
  if (aliases.length === 0) return true;
  return aliases.some((alias) => normalizedAddress.includes(normalizeText(alias)));
}

function isLikelyLandmarkQuery(query: string): boolean {
  return /(해변|해수욕장|오름|폭포|공원|수목원|정원|박물관|미술관|전망대|성산|일출봉|시장|거리|마을|숲길|둘레길)/.test(
    query,
  );
}

function categoryMatchesQuery(query: string, category: string | undefined): boolean {
  if (!category || !isLikelyLandmarkQuery(query)) return true;
  if (/여행|명소|문화|예술|레저|테마/.test(category)) return true;
  if (/시장/.test(query) && /쇼핑|유통|시장/.test(category)) return true;
  return false;
}

async function fetchNaverOnce(query: string): Promise<NaverLocalItem[] | null> {
  const url = `${NAVER_URL}?query=${encodeURIComponent(query)}&display=5`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("naver-timeout")), PER_CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": env.naverClientId,
        "X-Naver-Client-Secret": env.naverClientSecret,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: NaverLocalItem[] };
    return data.items ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchPlace(query: string, destHint?: string): Promise<PlaceLookupResult | undefined> {
  if (!env.naverClientId || !env.naverClientSecret) return undefined;

  const searchQuery = buildSearchQuery(query, destHint);
  let items = await fetchNaverOnce(searchQuery);
  if (items === null) {
    // 일시 장애(타임아웃·네트워크) 한 번만 재시도
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    items = await fetchNaverOnce(searchQuery);
  }
  if (!items || items.length === 0) return undefined;

  const scoreQuery = buildScoreQuery(query, destHint);
  const best = pickBest(scoreQuery, items);
  if (!best) return undefined;

  const info = toPlaceInfo(best, query);
  const address = best.roadAddress || best.address;
  if (!categoryMatchesQuery(query, best.category)) {
    const name = info.name ?? query;
    return {
      status: "rejected",
      warning: `지도 후보 "${name}"의 업종이 활동 장소와 달라 위치를 확정하지 않았습니다.`,
    };
  }
  if (!addressMatchesDestination(address, destHint)) {
    const name = info.name ?? query;
    return {
      status: "rejected",
      warning: `지도 후보 "${name}"의 주소가 목적지와 달라 위치를 확정하지 않았습니다.`,
    };
  }

  return { status: "ok", place: info };
}

export async function searchPlaceCandidates(
  query: string,
  destHint?: string,
  limit = 3,
): Promise<PlaceInfo[]> {
  assertServerEnv();
  if (!env.naverClientId || !env.naverClientSecret || !query.trim()) return [];

  const searchQuery = buildSearchQuery(query, destHint);
  let items = await fetchNaverOnce(searchQuery);
  if (items === null) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    items = await fetchNaverOnce(searchQuery);
  }
  if (!items || items.length === 0) return [];

  const scoreQuery = buildScoreQuery(query, destHint);
  const seen = new Set<string>();
  return items
    .map((item) => ({
      item,
      title: stripHtml(item.title ?? ""),
      score: overlapScore(scoreQuery, stripHtml(item.title ?? "")),
    }))
    .filter(
      ({ item, score }) =>
        score >= MIN_SCORE &&
        categoryMatchesQuery(query, item.category) &&
        addressMatchesDestination(item.roadAddress || item.address, destHint),
    )
    .flatMap(({ item }) => {
      const place = toPlaceInfo(item, query);
      const key = `${place.name ?? ""}|${place.address ?? ""}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [place];
    })
    .slice(0, limit);
}

function distanceKm(a: PlaceInfo, b: PlaceInfo): number {
  if (
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function rejectDayOutliers(plan: TravelPlan): void {
  for (const day of plan.days) {
    const placed = day.items.filter(hasGeocodedPlace);
    if (placed.length < 3) continue;

    for (const item of placed) {
      const distances = placed
        .filter((other) => other !== item)
        .map((other) => distanceKm(item.place!, other.place!))
        .sort((a, b) => a - b);
      const nearest = distances[0] ?? 0;
      if (nearest <= DAY_OUTLIER_THRESHOLD_KM) continue;

      const name = item.place?.name ?? item.place_query ?? item.text;
      (item as TravelItem).place = undefined;
      item.place_warning = `"${name}" 위치가 같은 날짜의 다른 장소들과 너무 멀어 지도 위치를 확정하지 않았습니다.`;
    }
  }
}

function hasGeocodedPlace(item: TravelItem): item is TravelItem & { place: PlaceInfo } {
  return typeof item.place?.lat === "number" && typeof item.place?.lng === "number";
}

export async function enrichPlan(plan: TravelPlan, destHint?: string): Promise<void> {
  assertServerEnv();
  if (!env.naverClientId || !env.naverClientSecret) return;

  const tasks: Array<Promise<void>> = [];
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.place_query) continue;
      tasks.push(
        searchPlace(item.place_query, destHint).then((result) => {
          if (!result) {
            item.place_warning = `"${item.place_query}" 장소를 지도에서 확인하지 못했습니다.`;
            return;
          }
          if (result.status === "ok") {
            item.place = result.place;
            item.place_warning = undefined;
          } else {
            item.place_warning = result.warning;
          }
        }),
      );
    }
  }
  if (
    plan.stay &&
    (typeof plan.stay.place?.lat !== "number" || typeof plan.stay.place?.lng !== "number")
  ) {
    const stay = plan.stay;
    tasks.push(
      searchPlace(stay.name, destHint).then((result) => {
        if (result?.status === "ok") stay.place = result.place;
      }),
    );
  }
  await Promise.all(tasks);
  rejectDayOutliers(plan);
}

export function computePlaceStats(plan: TravelPlan, repairedPlaces = 0): PlaceStats {
  const items = plan.days.flatMap((day) => day.items);
  const warnings = items.filter((item) => item.place_warning).length;
  return {
    totalPlaceQueries: items.filter((item) => Boolean(item.place_query)).length,
    verifiedPlaces: items.filter((item) => item.place).length,
    warnings,
    destinationMismatches: items.filter((item) => item.place_warning?.includes("주소가 목적지와 달라")).length,
    outlierRejects: items.filter((item) => item.place_warning?.includes("너무 멀어")).length,
    repairedPlaces,
  };
}
