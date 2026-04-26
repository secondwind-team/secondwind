export type TravelInput = {
  destination: string;
  startDate: string;
  endDate: string;
  prompt: string;
  planningModel: PlanningModel;
  budgetKrw?: number;
  budgetIncludes?: BudgetCategory[];
  stay?: Stay;
  /** @deprecated Use budgetIncludes. Kept for old shared links. */
  budgetScope?: BudgetScope;
};

export type PlanningModel = "classic" | "balanced" | "verified" | "grounded";

export type BudgetScope = "activity" | "with_transit" | "all";
export type BudgetCategory = "lodging" | "rental" | "transport" | "admission" | "food" | "shopping";

export const DEFAULT_BUDGET_SCOPE: BudgetScope = "activity";
export const DEFAULT_BUDGET_INCLUDES: BudgetCategory[] = [
  "lodging",
  "rental",
  "transport",
  "admission",
  "food",
];

export type BudgetScopeInfo = {
  id: BudgetScope;
  label: string;
  hint: string;
};

export const BUDGET_SCOPES: BudgetScopeInfo[] = [
  { id: "activity", label: "활동·식사·입장만", hint: "이동·숙박 별도" },
  { id: "with_transit", label: "+ 이동 비용", hint: "교통비까지 포함" },
  { id: "all", label: "전부", hint: "숙박·렌트카까지" },
];

export type BudgetCategoryInfo = {
  id: BudgetCategory;
  label: string;
  hint: string;
};

export const BUDGET_CATEGORIES: BudgetCategoryInfo[] = [
  { id: "lodging", label: "숙박", hint: "호텔·숙소" },
  { id: "rental", label: "렌트", hint: "렌터카" },
  { id: "transport", label: "교통", hint: "대중교통·택시" },
  { id: "admission", label: "입장", hint: "입장료·체험" },
  { id: "food", label: "식비", hint: "식사·카페" },
  { id: "shopping", label: "쇼핑", hint: "기념품·구매" },
];

export type PlanningModelInfo = {
  id: PlanningModel;
  label: string;
  shortLabel: string;
  description: string;
};

export const DEFAULT_PLANNING_MODEL: PlanningModel = "balanced";

export const PLANNING_MODELS: PlanningModelInfo[] = [
  {
    id: "classic",
    label: "빠른 추천",
    shortLabel: "빠른 추천",
    description: "일정 밀도와 속도를 우선합니다. 장소는 넉넉히 제안하되 일부는 확인이 필요할 수 있어요.",
  },
  {
    id: "balanced",
    label: "균형형",
    shortLabel: "균형형",
    description: "일정 완성도와 장소 정확도를 함께 봅니다. 실패한 장소는 한 번 고쳐봅니다.",
  },
  {
    id: "verified",
    label: "장소 정확도 우선",
    shortLabel: "정확도 우선",
    description: "지도 확인에 실패한 장소를 덜어내고 확실한 장소명만 남깁니다. 일정은 더 여유로워집니다.",
  },
  {
    id: "grounded",
    label: "지도 후보 기반",
    shortLabel: "후보 기반",
    description: "사용자 요청에서 키워드를 뽑아 지도 후보 풀을 먼저 만들고, 그 안에서만 장소를 고릅니다. 추천 장소가 적을 수 있지만 가짜 상호명을 만들 가능성이 가장 낮습니다.",
  },
];

export type PlaceStats = {
  totalPlaceQueries: number;
  verifiedPlaces: number;
  warnings: number;
  destinationMismatches: number;
  outlierRejects: number;
  repairedPlaces: number;
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
  place_warning?: string;
  cost_krw?: number;
  cost_label?: string;
  recommended_menu?: string;
  transit?: TransitInfo;
  place?: PlaceInfo;
};

export type BudgetExtra = { label: string; krw: number };

export type Stay = {
  name: string;
  place?: PlaceInfo;
};

export type DecisionSummary = {
  good_reasons: string[];
  check_before_confirming: string[];
  todo_after_confirming: string[];
};

export type TravelPlan = {
  rationale: string;
  stay?: Stay;
  decision?: DecisionSummary;
  days: Array<{ label: string; items: TravelItem[] }>;
  budget: { extras: BudgetExtra[] };
  caveats: string[];
};

export const USER_PROMPT_MAX = 1000;

export type TravelInputValidationReason =
  | "invalid-shape"
  | "missing-destination"
  | "missing-start-date"
  | "missing-end-date"
  | "invalid-start-date"
  | "invalid-end-date"
  | "end-before-start";

export type TravelInputValidationResult =
  | { ok: true; input: TravelInput }
  | { ok: false; reason: TravelInputValidationReason };

export function normalizeTravelInput(raw: unknown): TravelInput | null {
  const result = validateTravelInput(raw);
  return result.ok ? result.input : null;
}

export function validateTravelInput(raw: unknown): TravelInputValidationResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "invalid-shape" };
  const r = raw as Record<string, unknown>;
  const destination = typeof r.destination === "string" ? r.destination.trim().slice(0, 80) : "";
  const startDate = typeof r.startDate === "string" ? r.startDate : "";
  const endDate = typeof r.endDate === "string" ? r.endDate : "";
  const prompt = typeof r.prompt === "string" ? r.prompt.trim().slice(0, USER_PROMPT_MAX) : "";
  const planningModel = parsePlanningModel(r.planningModel);
  const budgetKrw = parseBudgetKrw(r.budgetKrw);
  const budgetIncludes = parseBudgetIncludes(r.budgetIncludes, r.budgetScope);
  const stay = parseStayInput(r.stay);

  if (!destination) return { ok: false, reason: "missing-destination" };
  if (!startDate) return { ok: false, reason: "missing-start-date" };
  if (!endDate) return { ok: false, reason: "missing-end-date" };
  if (!isValidDateString(startDate)) return { ok: false, reason: "invalid-start-date" };
  if (!isValidDateString(endDate)) return { ok: false, reason: "invalid-end-date" };
  if (endDate < startDate) return { ok: false, reason: "end-before-start" };

  const base: TravelInput = { destination, startDate, endDate, prompt, planningModel };
  if (stay) base.stay = stay;
  if (budgetKrw !== undefined) {
    base.budgetKrw = budgetKrw;
    base.budgetIncludes = budgetIncludes;
    const oldScope = parseBudgetScope(r.budgetScope);
    if (oldScope) base.budgetScope = oldScope;
  }
  return { ok: true, input: base };
}

const BUDGET_KRW_MAX = 100_000_000;

function parseBudgetKrw(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.min(BUDGET_KRW_MAX, Math.round(raw));
}

export function parseBudgetScope(raw: unknown): BudgetScope | undefined {
  return raw === "activity" || raw === "with_transit" || raw === "all" ? raw : undefined;
}

export function parseBudgetCategory(raw: unknown): BudgetCategory | undefined {
  return raw === "lodging" ||
    raw === "rental" ||
    raw === "transport" ||
    raw === "admission" ||
    raw === "food" ||
    raw === "shopping"
    ? raw
    : undefined;
}

export function parseBudgetIncludes(raw: unknown, legacyScope?: unknown): BudgetCategory[] {
  if (Array.isArray(raw)) {
    const out = raw.map(parseBudgetCategory).filter((v): v is BudgetCategory => Boolean(v));
    const unique = Array.from(new Set(out));
    return unique.length > 0 ? unique : DEFAULT_BUDGET_INCLUDES;
  }
  switch (parseBudgetScope(legacyScope)) {
    case "all":
      return ["lodging", "rental", "transport", "admission", "food", "shopping"];
    case "with_transit":
      return ["transport", "admission", "food"];
    case "activity":
      return ["admission", "food", "shopping"];
    default:
      return DEFAULT_BUDGET_INCLUDES;
  }
}

function parseStayInput(raw: unknown): Stay | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
  if (!name) return undefined;
  const placeRaw = typeof r.place === "object" && r.place !== null ? (r.place as Record<string, unknown>) : undefined;
  const place: PlaceInfo | undefined = placeRaw
    ? {
        name: typeof placeRaw.name === "string" ? placeRaw.name.slice(0, 120) : undefined,
        address: typeof placeRaw.address === "string" ? placeRaw.address.slice(0, 200) : undefined,
        phone: typeof placeRaw.phone === "string" ? placeRaw.phone.slice(0, 40) : undefined,
        category: typeof placeRaw.category === "string" ? placeRaw.category.slice(0, 120) : undefined,
        url: typeof placeRaw.url === "string" ? placeRaw.url.slice(0, 500) : undefined,
        lat: typeof placeRaw.lat === "number" && Number.isFinite(placeRaw.lat) ? placeRaw.lat : undefined,
        lng: typeof placeRaw.lng === "number" && Number.isFinite(placeRaw.lng) ? placeRaw.lng : undefined,
      }
    : undefined;
  return place ? { name, place } : { name };
}

export function getBudgetScopeInfo(scope: BudgetScope): BudgetScopeInfo {
  return BUDGET_SCOPES.find((s) => s.id === scope) ?? BUDGET_SCOPES[0]!;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePlanningModel(raw: unknown): PlanningModel {
  return raw === "classic" || raw === "balanced" || raw === "verified" || raw === "grounded"
    ? raw
    : DEFAULT_PLANNING_MODEL;
}

export function getPlanningModelInfo(model: PlanningModel): PlanningModelInfo {
  return PLANNING_MODELS.find((m) => m.id === model) ?? PLANNING_MODELS[0]!;
}

const SYSTEM_PROMPT = `당신은 J 강박이 있는 한국인 여행자를 돕는 계획자입니다.
규칙:
- 하나의 확정 계획만 제시. 대안·옵션 언급 금지.
- 한국어로 간결하게. 과장·감탄사·이모지 없음.
- 각 day 3~8개의 구체적 활동. 장소 이름은 가능한 한 실제 존재하는 곳으로.
- 각 day 에 **점심 식사 장소**와 **저녁 식사 장소**를 반드시 포함 (이동일이어도 최소 한 끼).
- 사용자 자유 요청에 인원·동행자 정보(예: "성인 2, 아이 1")가 포함되어 있으면 이를 해석해 장소 선정에 반영 (어린이·영유아 있으면 아이 친화 우선, 청소년 있으면 활동성 고려).
- 각 item 필드:
  - text: 활동 설명 한 줄
  - time: 대략 24시간 형식 "HH:MM"
  - place_query: 지도에서 **1개의 특정 장소로 찾아질 고유명사** (예: "성산일출봉", "카페 델문도", "흑돈가 성산점"). 모든 item 에 이 필드를 포함하되, 아래 규칙 때문에 특정 장소를 확정할 수 없으면 빈 문자열 "".
    1) 일반 카테고리 검색어 금지: "함덕 카페", "제주 맛집", "서귀포 관광지" 같이 "지역 + 카테고리" 조합은 단일 POI 로 식별 불가능 → 금지. 구체적 상호명을 모르면 빈 문자열 "".
    2) 단일 POI 가 아닌 시설 금지: "제주공항 렌터카 하우스"(여러 업체 혼합 시설), "동문시장 과일가게"(개별 점포 불확실) 등 금지.
    3) 다음 활동은 무조건 생략 (transit 필드도 붙이지 말 것): 공항 도착/출발, 렌터카 수령/반납, 호텔·숙소 체크인/아웃, 조식, "산책·휴식·드라이브·쇼핑" 같이 특정 장소 없는 활동. 이런 이동 자체는 별도 item 이 아니라 다음 실제 장소의 transit 필드로 표현.
  - cost_krw: 해당 장소에서 일행 전체 예상 비용 (식대·카페·체험비·입장료 등). 무료이거나 의미 없으면 생략.
  - cost_label: "식사" | "카페" | "입장료" | "체험" | "쇼핑" 등. 애매하면 생략 (UI 가 "비용" 으로 표기).
  - recommended_menu: 음식점인 경우 추천 메뉴 1~2개 (짧게, 예: "흑돼지 두루치기").
  - transit: 직전 item 에서 이 item 으로 오는 이동 정보 객체.
    - mode: "차량" | "도보" | "지하철" | "버스" | "택시" | "비행기" | "자전거" 등 한국어 자유.
    - duration_min: 5~480 사이 정수 (분).
    - cost_krw: 대중교통·택시·주차 등 비용. 본인 차량·도보 등 무료면 생략 또는 0.
    - note: "환승 있음", "주차 혼잡" 등 짧은 메모 (필요할 때만).
    - 각 day 의 **첫 item (시작점) 만** transit 생략. 그 외 모든 item 은 transit 필드 필수 (값 누락 금지, 대중교통·도보도 transit 에 기입).
- stay: 사용자 자유 요청에 **구체적인 숙소명** 이 명시돼 있으면 (예: "숙소: 네스트호텔", "호텔: 그랜드조선") 그 이름만 뽑아 { "name": string } 으로 제공. "아직 안 정함"·"미정"·"게스트하우스 아무거나" 처럼 특정되지 않았거나 명시 없으면 stay 필드 자체 생략. name 에는 상호명만, 부가 설명 제외.
- budget.extras: 숙박비·렌터카·기타 item 단위가 아닌 일정 전체 비용. 각 { label, krw }. 없으면 빈 배열.
- decision: 사용자가 이 계획을 확정할지 빠르게 판단하도록 돕는 결정 요약.
  - good_reasons: "이 일정으로 가도 되는 이유" 2~3개. 사용자 요청과 일정 구성을 연결해 구체적으로 작성. 과장 금지.
    - **예산 초과 시 금지 표현**: user prompt 의 "요청 예산" 라인이 있고 명시된 포함 범위 합계가 예산을 초과하면, good_reasons 에 "예산 내", "예산 이내", "예산 맞춰", "X만원 안에서", "예산 범위", "예산 충족" 같이 예산이 지켜졌음을 시사하는 표현 절대 금지. 비용 자랑 자체를 빼고 동선·구성·맛집 같은 다른 강점만 적는다.
  - check_before_confirming: "확정 전에 확인할 것" 2~4개. 영업시간·휴무일·AI 추정 가격·이동 불확실성처럼 실제 확인이 필요한 항목. 예약 기능처럼 쓰지 말 것.
    - **예산 초과 시 첫 항목 강제**: user prompt 의 "요청 예산" 라인이 있고 합계가 초과하면, 첫 항목으로 "요청 예산 X만원 · 예상 Y만원 (Z만원 초과) — 비용 항목 재검토 필요" 형식 고정.
  - todo_after_confirming: "확정 후 할 일" 3~5개. 실제 예약 연동이 아니라 단순 체크리스트. 예: 숙소 예약 여부 확인, 식당 영업시간 확인, 동행자에게 공유 링크 보내기.
- rationale: **2~4문장** 으로 이 일정을 이렇게 설계한 근거를 서술.
  1) 왜 이 구성인지: 사용자 요청 (목적지·기간·자유 요청) 과 제약을 어떻게 반영했는지 (예: "아이 낮잠 시간 13~15시 피해서 실내 일정 집중").
  2) **사용자 자유 요청 중 달성 못한 부분이 있으면** 해당 항목과 이유를 반드시 포함. 달성 못한 게 없으면 (2) 생략.
     - **예산**: user prompt 의 "요청 예산" 라인이 있을 때, 그 라인에 명시된 포함 범위 (활동·식사 / + 이동 / 일정 전체) 의 합계가 예산을 초과하면, rationale 에 "요청 예산 X만원 · 예상 Y만원 (Z만원 초과)" 숫자 명시 + 주원인 + 대안 제시 필수. "숙박비 별도", "식비 기준" 같이 뭉개는 표현 금지.
     - **기타 요청**: "차 없이", "특정 메뉴", "특정 시간대 회피" 등 프롬프트에 적힌 구체 요청을 못 맞췄으면 사유 설명.
  톤: "이 정도면 70% 사람 만족할 계획입니다" 의 담백함, 과장·감탄사·이모지 없음. summary-like 미사여구 금지.
- caveats 에는 검증되지 않은 정보(주소·영업시간·가격·메뉴) 주의 문구 1~2개 포함.
- 사용자 자유 요청이 있으면 최대한 반영하되, 다른 규칙과 충돌하면 규칙을 우선.
- 응답은 반드시 JSON. markdown, 주석, 여분 텍스트 금지.`;

export function buildTravelPrompt(input: TravelInput): { system: string; user: string } {
  const requestLine = input.prompt.trim()
    ? `자유 요청: ${input.prompt.trim()}`
    : "자유 요청: (없음)";

  const lines = [
    `목적지: ${input.destination}`,
    `기간: ${input.startDate} ~ ${input.endDate}`,
    requestLine,
  ];
  if (input.stay?.name) {
    lines.push(
      `선택 숙소: ${input.stay.name}${input.stay.place?.address ? ` (${input.stay.place.address})` : ""}`,
      "숙소 지시: 요청사항에 다른 기준점이 명시되지 않았다면 이 숙소를 거점으로 동선을 설계하고 stay 필드에 같은 숙소명을 포함.",
    );
  }
  if (typeof input.budgetKrw === "number" && input.budgetKrw > 0) {
    lines.push(
      `요청 예산: ${input.budgetKrw.toLocaleString("ko-KR")}원 (포함 항목: ${describeBudgetIncludes(input.budgetIncludes ?? DEFAULT_BUDGET_INCLUDES)})`,
    );
  }

  const userPrompt = [
    ...lines,
    "",
    "아래 JSON 스키마에 정확히 맞춰 답해주세요 (optional 필드는 값이 없으면 생략):",
    "{",
    '  "rationale": string,',
    '  "stay"?: { "name": string },',
    '  "days": [ { "label": string, "items": [ {',
    '    "text": string,',
    '    "time"?: string,',
    '    "place_query": string,',
    '    "cost_krw"?: number,',
    '    "cost_label"?: string,',
    '    "recommended_menu"?: string,',
    '    "transit"?: { "mode": string, "duration_min": number, "cost_krw"?: number, "note"?: string }',
    '  } ] } ],',
    '  "decision"?: {',
    '    "good_reasons": string[],',
    '    "check_before_confirming": string[],',
    '    "todo_after_confirming": string[]',
    "  },",
    '  "budget": { "extras": [ { "label": string, "krw": number } ] },',
    '  "caveats": string[]',
    "}",
  ].join("\n");
  return { system: `${SYSTEM_PROMPT}\n\n${planningModelInstruction(input.planningModel)}`, user: userPrompt };
}

function describeBudgetScope(scope: BudgetScope): string {
  switch (scope) {
    case "with_transit":
      return "활동·식사·입장 + 이동 비용 (숙박·렌트카 별도)";
    case "all":
      return "활동·식사·입장 + 이동 + 숙박·렌트카 등 일정 전체";
    case "activity":
    default:
      return "활동·식사·입장 항목만 (이동·숙박 별도)";
  }
}

export function describeBudgetIncludes(includes: BudgetCategory[]): string {
  const set = new Set(includes);
  const labels = BUDGET_CATEGORIES.filter((item) => set.has(item.id)).map((item) => item.label);
  return labels.length > 0 ? labels.join(", ") : "지정 없음";
}

function planningModelInstruction(model: PlanningModel): string {
  if (model === "classic") {
    return [
      "추천 모델: 빠른 추천.",
      "- 목표: 사용자가 바로 훑을 수 있는 풍성한 초안. 각 day 5~7개 활동.",
      "- 유명 관광지·대표 상권·널리 알려진 식당/카페를 적극 활용해 일정 완성도를 우선한다.",
      '- 단, "지역+카테고리" 조합은 쓰지 말고 구체 장소가 불확실하면 place_query 는 빈 문자열 "" 로 둔다.',
    ].join("\n");
  }
  if (model === "verified") {
    return [
      "추천 모델: 장소 정확도 우선.",
      "- 목표: 지도에서 확인될 가능성이 높은 장소만 남기는 보수적 일정. 각 day 3~5개 활동.",
      "- 활동 수를 줄여도 좋다. 점심/저녁 식사는 유지하되, 식당 상호가 확실하지 않으면 활동 설명만 쓰고 place_query 는 빈 문자열로 둔다.",
      "- 지역+카테고리 조합, 기억이 불확실한 식당/카페명, 분점 불명확한 체인명은 피한다.",
      "- 이 초안의 장소명은 지도 후보 검수 패스에서 다시 확인된다. 후보로 확인되지 않을 수 있는 장소는 빈 place_query 로 두는 편을 우선한다.",
      '- 확실한 고유명사를 모르면 place_query 는 빈 문자열 "" 로 두고 text 에도 단정적인 상호명을 쓰지 않는다.',
    ].join("\n");
  }
  if (model === "grounded") {
    return [
      "추천 모델: 지도 후보 기반.",
      "- 목표: 사전에 수집된 지도 후보 풀 안에서만 장소를 선택하는 가장 보수적 모델. 각 day 3~5개 활동.",
      "- 사용자 자유 요청 끝에 [후보 풀] 섹션이 첨부됩니다. place_query 는 반드시 그 풀의 name 과 글자 그대로 같은 문자열만 사용하세요.",
      "- 풀에 적합한 후보가 없는 활동(공항·휴식·산책·드라이브 등)은 text 만 적고 place_query 는 빈 문자열 \"\" 로 둡니다.",
      "- 풀 밖의 새 상호명을 만들면 검수 단계에서 모두 제거되어 사용자에게 빈 항목으로 보입니다 — 풀에서만 고르세요.",
      "- 같은 풀 항목을 여러 번 반복하지 마세요 (예외: 사용자가 명시한 숙소).",
      "- 점심/저녁 식사는 유지하되, 풀에 식당 후보가 없으면 \"점심 식사 (현지에서 결정)\" 처럼 일반 활동으로 적고 place_query 는 빈 문자열.",
      "- recommended_menu 와 cost_krw 는 모두 AI 추정입니다. 확실하지 않은 메뉴·가격은 생략하세요. cost_label 만 적어도 됩니다.",
    ].join("\n");
  }
  return [
    "추천 모델: 균형형.",
    "- 목표: 일정 완성도와 장소 정확도의 균형. 각 day 4~6개 활동.",
    "- 식사 장소는 가능한 한 실제 고유명사를 쓰되, 확실하지 않으면 빈 place_query 로 둔다.",
    "- 빠른 추천보다 장소 수를 조금 줄여도 좋고, 장소 정확도 우선보다 일정 완성도를 더 챙긴다.",
    "- 동선상 핵심 장소는 단일 POI 로 검색될 가능성이 높은 이름을 우선한다.",
  ].join("\n");
}

// Gemini responseSchema (OpenAPI 3.0 subset). 생성 품질을 위해 place_query 는 필수로 강제한다.
// type guard 는 기존 공유 링크 호환을 위해 optional 을 계속 허용한다.
export const TRAVEL_PLAN_SCHEMA = {
  type: "object",
  properties: {
    rationale: { type: "string" },
    stay: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    decision: {
      type: "object",
      properties: {
        good_reasons: { type: "array", items: { type: "string" } },
        check_before_confirming: { type: "array", items: { type: "string" } },
        todo_after_confirming: { type: "array", items: { type: "string" } },
      },
      required: ["good_reasons", "check_before_confirming", "todo_after_confirming"],
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                time: { type: "string" },
                place_query: { type: "string" },
                place_warning: { type: "string" },
                cost_krw: { type: "number" },
                cost_label: { type: "string" },
                recommended_menu: { type: "string" },
                transit: {
                  type: "object",
                  properties: {
                    mode: { type: "string" },
                    duration_min: { type: "number" },
                    cost_krw: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["mode", "duration_min"],
                },
              },
              required: ["text", "place_query"],
            },
          },
        },
        required: ["label", "items"],
      },
    },
    budget: {
      type: "object",
      properties: {
        extras: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              krw: { type: "number" },
            },
            required: ["label", "krw"],
          },
        },
      },
      required: ["extras"],
    },
    caveats: { type: "array", items: { type: "string" } },
  },
  required: ["rationale", "days", "budget", "caveats"],
} as const;

export function parseTravelPlan(raw: string): TravelPlan | null {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isTravelPlan(parsed)) return null;
  sanitizeGeneratedPlan(parsed);
  return parsed;
}

function sanitizeGeneratedPlan(plan: TravelPlan): void {
  for (const day of plan.days) {
    day.items.forEach((item, index) => {
      if (index === 0) {
        item.transit = undefined;
      }
      if (shouldSuppressPlaceQuery(item)) {
        item.place_query = "";
      }
    });
  }
  suppressRepeatedPlaceQueries(plan);
}

function shouldSuppressPlaceQuery(item: TravelItem): boolean {
  const text = `${item.text} ${item.place_query ?? ""}`;
  return (
    /공항\s*(도착|출발)|렌터카\s*(수령|반납)|렌트카\s*(수령|반납)|체크인|체크아웃|조식|낮잠|숙소.*(복귀|휴식)|호텔.*휴식/.test(text) ||
    isGenericPlaceQuery(item.place_query)
  );
}

function isGenericPlaceQuery(query: string | undefined): boolean {
  if (!query) return false;
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/(근처|주변|인근).*(식당|맛집|카페|횟집|해산물|돈까스|흑돼지)|맛집|시내\s*(식당|카페|맛집)|지역\s*(식당|카페)/.test(normalized)) {
    return true;
  }
  if (/^(제주|부산|강릉|서귀포|애월|성산|중문|광안리|남포동|해운대|기장|강릉역|이호테우|월정리|함덕)\s*(식당|맛집|카페|횟집|해산물|돈까스|흑돼지|고기국수)$/.test(normalized)) {
    return true;
  }
  return false;
}

function suppressRepeatedPlaceQueries(plan: TravelPlan): void {
  const seen = new Set<string>();
  for (const day of plan.days) {
    for (const item of day.items) {
      const query = item.place_query?.replace(/\s+/g, " ").trim();
      if (!query) continue;
      const key = query.toLowerCase();
      if (seen.has(key)) {
        item.place_query = "";
        continue;
      }
      seen.add(key);
    }
  }
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

export type BudgetTotals = ReturnType<typeof computeBudget>;

export type BudgetBreakdown = Record<BudgetCategory, number>;

export function computeBudgetBreakdown(budget: BudgetTotals, plan?: TravelPlan): BudgetBreakdown {
  const breakdown: BudgetBreakdown = {
    lodging: 0,
    rental: 0,
    transport: budget.transit,
    admission: 0,
    food: 0,
    shopping: 0,
  };
  for (const item of budget.activityItems) {
    const category = classifyBudgetItem(`${item.label ?? ""} ${item.text}`);
    breakdown[category] += item.krw;
  }
  for (const extra of plan?.budget.extras ?? []) {
    const category = classifyBudgetItem(extra.label);
    breakdown[category] += extra.krw;
  }
  return breakdown;
}

function classifyBudgetItem(text: string): BudgetCategory {
  if (/숙박|숙소|호텔|리조트|스테이|게스트하우스|펜션/.test(text)) return "lodging";
  if (/렌트|렌터|렌트카|렌터카|차량/.test(text)) return "rental";
  if (/이동|교통|택시|버스|지하철|기차|KTX|항공|비행|주차/.test(text)) return "transport";
  if (/쇼핑|기념품|구매|시장/.test(text)) return "shopping";
  if (/식사|점심|저녁|아침|카페|브런치|메뉴|맛집|식비|음식|디저트|커피/.test(text)) return "food";
  return "admission";
}

export function scopedBudgetTotal(scope: BudgetScope, budget: BudgetTotals): number {
  switch (scope) {
    case "all":
      return budget.total;
    case "with_transit":
      return budget.activity + budget.transit;
    case "activity":
    default:
      return budget.activity;
  }
}

export function includedBudgetTotal(
  includes: BudgetCategory[],
  budget: BudgetTotals,
  plan?: TravelPlan,
): number {
  const breakdown = computeBudgetBreakdown(budget, plan);
  const set = new Set(includes);
  return BUDGET_CATEGORIES.reduce((sum, item) => (set.has(item.id) ? sum + breakdown[item.id] : sum), 0);
}

// 5% 여유: 활동비는 AI 추정이라 작은 오차로 매번 배너가 뜨지 않게.
const BUDGET_TOLERANCE_RATIO = 0.05;

export type BudgetCheck = {
  requested: number;
  scope?: BudgetScope;
  includes: BudgetCategory[];
  scopedTotal: number;
  overage: number;
};

export function evaluateBudget(
  budget: BudgetTotals,
  requested: number | undefined,
  scopeOrIncludes: BudgetScope | BudgetCategory[] = DEFAULT_BUDGET_INCLUDES,
  plan?: TravelPlan,
): BudgetCheck | null {
  if (!requested || requested <= 0) return null;
  const includes = Array.isArray(scopeOrIncludes)
    ? parseBudgetIncludes(scopeOrIncludes)
    : parseBudgetIncludes(undefined, scopeOrIncludes);
  const scopedTotal = includedBudgetTotal(includes, budget, plan);
  const overage = scopedTotal - requested;
  if (overage <= requested * BUDGET_TOLERANCE_RATIO) return null;
  return {
    requested,
    scope: Array.isArray(scopeOrIncludes) ? undefined : scopeOrIncludes,
    includes,
    scopedTotal,
    overage,
  };
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
  if (!isOptString(i.place_warning)) return false;
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

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function isDecisionSummary(v: unknown): v is DecisionSummary {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  if (!isStringArray(d.good_reasons)) return false;
  if (!isStringArray(d.check_before_confirming)) return false;
  if (!isStringArray(d.todo_after_confirming)) return false;
  return true;
}

function isStay(v: unknown): v is Stay {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s.name !== "string" || s.name.trim().length === 0) return false;
  // place 는 enrich 단계에서 채워지므로 LLM 응답에서는 없는 게 정상
  return true;
}

export function isTravelPlan(v: unknown): v is TravelPlan {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  if (typeof p.rationale !== "string") return false;
  if (p.stay !== undefined && !isStay(p.stay)) return false;
  if (p.decision !== undefined && !isDecisionSummary(p.decision)) return false;
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
