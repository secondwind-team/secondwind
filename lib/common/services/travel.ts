export type TravelParty = {
  adults: number;
  teens: number;
  kids: number;
  infants: number;
};

export const PARTY_KEYS = ["adults", "teens", "kids", "infants"] as const;
export type PartyKey = (typeof PARTY_KEYS)[number];

export const PARTY_LABELS: Record<PartyKey, string> = {
  adults: "성인",
  teens: "청소년",
  kids: "어린이",
  infants: "영유아",
};

export type TravelInput = {
  destination: string;
  startDate: string;
  endDate: string;
  party: TravelParty;
  prompt: string;
};

export type TransitInfo = {
  mode: string;
  duration_min: number;
  cost_krw?: number;
  note?: string;
};

export type PlaceInfo = {
  name?: string;
  address?: string;
  phone?: string;
  category?: string;
  url?: string;
  lat?: number;
  lng?: number;
};

export type TravelItem = {
  text: string;
  time?: string;
  place_query?: string;
  cost_krw?: number;
  cost_label?: string;
  recommended_menu?: string;
  transit?: TransitInfo;
  place?: PlaceInfo;
};

export type BudgetExtra = { label: string; krw: number };

export type TravelPlan = {
  summary_line: string;
  days: Array<{ label: string; items: TravelItem[] }>;
  budget: { extras: BudgetExtra[] };
  caveats: string[];
};

export const USER_PROMPT_MAX = 300;

const SYSTEM_PROMPT = `당신은 J 강박이 있는 한국인 여행자를 돕는 계획자입니다.
규칙:
- 하나의 확정 계획만 제시. 대안·옵션 언급 금지.
- 한국어로 간결하게. 과장·감탄사·이모지 없음.
- 각 day 5~8개의 구체적 활동. 장소 이름은 가능한 한 실제 존재하는 곳으로.
- 각 day 에 **점심 식사 장소**와 **저녁 식사 장소**를 반드시 포함 (이동일이어도 최소 한 끼).
- 인원 구성에 맞는 장소 선정 (어린이·영유아 있으면 아이 친화 우선, 청소년 있으면 활동성 고려).
- 각 item 필드:
  - text: 활동 설명 한 줄
  - time: 대략 24시간 형식 "HH:MM"
  - place_query: 지도에서 **1개의 특정 장소로 찾아질 고유명사** (예: "성산일출봉", "카페 델문도", "흑돈가 성산점"). 다음 **3개 규칙 엄수:**
    1) 일반 카테고리 검색어 금지: "함덕 카페", "제주 맛집", "서귀포 관광지" 같이 "지역 + 카테고리" 조합은 단일 POI 로 식별 불가능 → 금지. 구체적 상호명을 모르면 place_query 생략.
    2) 단일 POI 가 아닌 시설 금지: "제주공항 렌터카 하우스"(여러 업체 혼합 시설), "동문시장 과일가게"(개별 점포 불확실) 등 금지.
    3) 다음 활동은 무조건 생략: 공항 도착/출발, 렌터카 수령/반납, 호텔·숙소 체크인/아웃, 조식, "산책·휴식·드라이브·쇼핑" 같이 특정 장소 없는 활동.
  - cost_krw: 해당 장소에서 일행 전체 예상 비용 (식대·카페·체험비·입장료 등). 무료이거나 의미 없으면 생략.
  - cost_label: "식사" | "카페" | "입장료" | "체험" | "쇼핑" 등. 애매하면 생략 (UI 가 "비용" 으로 표기).
  - recommended_menu: 음식점인 경우 추천 메뉴 1~2개 (짧게, 예: "흑돼지 두루치기").
  - transit: 직전 item 에서 이 item 으로 오는 이동 정보 객체.
    - mode: "차량" | "도보" | "지하철" | "버스" | "택시" | "비행기" | "자전거" 등 한국어 자유.
    - duration_min: 5~480 사이 정수 (분).
    - cost_krw: 대중교통·택시·주차 등 비용. 본인 차량·도보 등 무료면 생략 또는 0.
    - note: "환승 있음", "주차 혼잡" 등 짧은 메모 (필요할 때만).
    - 첫 item (하루의 시작점) 은 transit 생략 가능.
- budget.extras: 숙박비·렌터카·기타 item 단위가 아닌 일정 전체 비용. 각 { label, krw }. 없으면 빈 배열.
- summary_line 은 "이 정도면 70% 사람 만족할 계획입니다" 톤의 한 문장 (이 문장을 그대로 쓰지 말고 플랜 디테일을 반영해서 변주).
- caveats 에는 검증되지 않은 정보(주소·영업시간·가격·메뉴) 주의 문구 1~2개 포함.
- 사용자 자유 요청이 있으면 최대한 반영하되, 다른 규칙과 충돌하면 규칙을 우선.
- 응답은 반드시 JSON. markdown, 주석, 여분 텍스트 금지.`;

function formatParty(party: TravelParty): string {
  const parts: string[] = [];
  for (const key of PARTY_KEYS) {
    const n = party[key];
    if (n > 0) parts.push(`${PARTY_LABELS[key]} ${n}명`);
  }
  return parts.length > 0 ? parts.join(", ") : "성인 1명";
}

export function partyTotal(party: TravelParty): number {
  return PARTY_KEYS.reduce((sum, k) => sum + party[k], 0);
}

export function buildTravelPrompt(input: TravelInput): { system: string; user: string } {
  const requestLine = input.prompt.trim()
    ? `자유 요청: ${input.prompt.trim()}`
    : "자유 요청: (없음)";

  const userPrompt = [
    `목적지: ${input.destination}`,
    `기간: ${input.startDate} ~ ${input.endDate}`,
    `인원: ${formatParty(input.party)}`,
    requestLine,
    "",
    "아래 JSON 스키마에 정확히 맞춰 답해주세요 (optional 필드는 값이 없으면 생략):",
    "{",
    '  "summary_line": string,',
    '  "days": [ { "label": string, "items": [ {',
    '    "text": string,',
    '    "time"?: string,',
    '    "place_query"?: string,',
    '    "cost_krw"?: number,',
    '    "cost_label"?: string,',
    '    "recommended_menu"?: string,',
    '    "transit"?: { "mode": string, "duration_min": number, "cost_krw"?: number, "note"?: string }',
    '  } ] } ],',
    '  "budget": { "extras": [ { "label": string, "krw": number } ] },',
    '  "caveats": string[]',
    "}",
  ].join("\n");
  return { system: SYSTEM_PROMPT, user: userPrompt };
}

export function parseTravelPlan(raw: string): TravelPlan | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isTravelPlan(parsed)) return null;
  return parsed;
}

// `/link/` 포맷은 모바일에서 카카오맵 앱 deep link 가 걸려 네이버/카카오 앱이 섞여 뜨는 원인이 됨.
// `?q=` 는 브라우저에서 항상 카카오맵 웹이 열림.
export function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
}

export type PointEntry = {
  item: TravelItem;
  dayIndex: number;
  orderInDay: number;
  label: string;
  lat: number;
  lng: number;
};

export function enumeratePoints(plan: TravelPlan): PointEntry[] {
  const out: PointEntry[] = [];
  plan.days.forEach((day, dayIndex) => {
    let orderInDay = 0;
    for (const item of day.items) {
      const lat = item.place?.lat;
      const lng = item.place?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      orderInDay += 1;
      out.push({
        item,
        dayIndex,
        orderInDay,
        label: `${dayIndex + 1}-${orderInDay}`,
        lat,
        lng,
      });
    }
  });
  return out;
}

export function computeBudget(plan: TravelPlan): {
  activity: number;
  transit: number;
  extras: number;
  total: number;
  activityItems: Array<{ day: string; time?: string; text: string; krw: number; label?: string }>;
  transitItems: Array<{ day: string; time?: string; to: string; krw: number; mode: string; duration_min: number }>;
} {
  let activity = 0;
  let transit = 0;
  const activityItems: Array<{ day: string; time?: string; text: string; krw: number; label?: string }> = [];
  const transitItems: Array<{ day: string; time?: string; to: string; krw: number; mode: string; duration_min: number }> = [];

  for (const day of plan.days) {
    for (const item of day.items) {
      if (typeof item.cost_krw === "number" && item.cost_krw > 0) {
        activity += item.cost_krw;
        activityItems.push({
          day: day.label,
          time: item.time,
          text: item.text,
          krw: item.cost_krw,
          label: item.cost_label,
        });
      }
      if (item.transit && typeof item.transit.cost_krw === "number" && item.transit.cost_krw > 0) {
        transit += item.transit.cost_krw;
        transitItems.push({
          day: day.label,
          time: item.time,
          to: item.text,
          krw: item.transit.cost_krw,
          mode: item.transit.mode,
          duration_min: item.transit.duration_min,
        });
      }
    }
  }
  const extras = plan.budget.extras.reduce((s, e) => s + (Number.isFinite(e.krw) ? e.krw : 0), 0);
  return { activity, transit, extras, total: activity + transit + extras, activityItems, transitItems };
}

// --- type guards ---

function isOptString(v: unknown): boolean {
  return v === undefined || typeof v === "string";
}
function isOptFinite(v: unknown): boolean {
  return v === undefined || (typeof v === "number" && Number.isFinite(v));
}

function isTransitInfo(v: unknown): v is TransitInfo {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  if (typeof t.mode !== "string") return false;
  if (typeof t.duration_min !== "number" || !Number.isFinite(t.duration_min)) return false;
  if (!isOptFinite(t.cost_krw)) return false;
  if (!isOptString(t.note)) return false;
  return true;
}

function isTravelItem(v: unknown): v is TravelItem {
  if (typeof v !== "object" || v === null) return false;
  const i = v as Record<string, unknown>;
  if (typeof i.text !== "string") return false;
  if (!isOptString(i.time)) return false;
  if (!isOptString(i.place_query)) return false;
  if (!isOptFinite(i.cost_krw)) return false;
  if (!isOptString(i.cost_label)) return false;
  if (!isOptString(i.recommended_menu)) return false;
  if (i.transit !== undefined && !isTransitInfo(i.transit)) return false;
  return true;
}

function isBudgetExtra(v: unknown): v is BudgetExtra {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.label === "string" && typeof e.krw === "number" && Number.isFinite(e.krw);
}

function isTravelPlan(v: unknown): v is TravelPlan {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  if (typeof p.summary_line !== "string") return false;
  if (!Array.isArray(p.days)) return false;
  for (const d of p.days) {
    if (typeof d !== "object" || d === null) return false;
    const day = d as Record<string, unknown>;
    if (typeof day.label !== "string") return false;
    if (!Array.isArray(day.items) || !day.items.every(isTravelItem)) return false;
  }
  if (typeof p.budget !== "object" || p.budget === null) return false;
  const budget = p.budget as Record<string, unknown>;
  if (!Array.isArray(budget.extras) || !budget.extras.every(isBudgetExtra)) return false;
  if (!Array.isArray(p.caveats) || !p.caveats.every((c) => typeof c === "string")) return false;
  return true;
}
