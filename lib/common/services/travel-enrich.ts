import { env, assertServerEnv } from "@/lib/common/env";
import { kakaoMapSearchUrl, type PlaceInfo, type TravelPlan } from "./travel";

const NAVER_URL = "https://openapi.naver.com/v1/search/local.json";
const PER_CALL_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 300;

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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
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

async function searchPlace(query: string, destHint?: string): Promise<PlaceInfo | undefined> {
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

  const info: PlaceInfo = {};
  if (best.title) info.name = stripHtml(best.title);
  const address = best.roadAddress || best.address;
  if (address) info.address = address;
  if (best.telephone) info.phone = best.telephone;
  if (best.category) info.category = best.category;

  const lng = best.mapx ? Number(best.mapx) / 1e7 : NaN;
  const lat = best.mapy ? Number(best.mapy) / 1e7 : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    info.lat = lat;
    info.lng = lng;
  }

  info.url = kakaoMapSearchUrl(info.name ?? query);
  return info;
}

export async function enrichPlan(plan: TravelPlan, destHint?: string): Promise<void> {
  assertServerEnv();
  if (!env.naverClientId || !env.naverClientSecret) return;

  const tasks: Array<Promise<void>> = [];
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.place_query) continue;
      tasks.push(
        searchPlace(item.place_query, destHint).then((info) => {
          if (info) item.place = info;
        }),
      );
    }
  }
  if (plan.stay) {
    const stay = plan.stay;
    tasks.push(
      searchPlace(stay.name, destHint).then((info) => {
        if (info) stay.place = info;
      }),
    );
  }
  await Promise.all(tasks);
}
