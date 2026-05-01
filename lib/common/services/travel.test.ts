import { describe, expect, it } from "vitest";
import {
  applyMustVisitToPlan,
  buildTravelPrompt,
  evaluateBudget,
  normalizeMustVisitName,
  normalizeTravelInput,
  parseBudgetIncludes,
  parseTravelPlan,
  type MustVisitItem,
  type TravelInput,
  type TravelPlan,
} from "./travel";

const baseRaw = {
  rationale: "test",
  days: [{ label: "1일", items: [{ text: "출발", place_query: "" }] }],
  budget: { extras: [] },
  caveats: [],
};

function rawWith(extra: Record<string, unknown>): string {
  return JSON.stringify({ ...baseRaw, ...extra });
}

describe("parseTravelPlan — decision 정규화 (PR #53)", () => {
  it("decision 의 세 배열이 모두 있으면 그대로 보존", () => {
    const plan = parseTravelPlan(
      rawWith({
        decision: {
          good_reasons: ["g"],
          check_before_confirming: ["c"],
          todo_after_confirming: ["t"],
        },
      }),
    );
    expect(plan?.decision).toEqual({
      good_reasons: ["g"],
      check_before_confirming: ["c"],
      todo_after_confirming: ["t"],
    });
  });

  it("partial decision (한 배열만) 도 통과시키고 나머지를 빈 배열로 채움", () => {
    const plan = parseTravelPlan(rawWith({ decision: { good_reasons: ["g"] } }));
    expect(plan).not.toBeNull();
    expect(plan?.decision).toEqual({
      good_reasons: ["g"],
      check_before_confirming: [],
      todo_after_confirming: [],
    });
  });

  it("빈 객체 decision 은 셋 다 빈 배열로 채워 통과", () => {
    const plan = parseTravelPlan(rawWith({ decision: {} }));
    expect(plan?.decision).toEqual({
      good_reasons: [],
      check_before_confirming: [],
      todo_after_confirming: [],
    });
  });

  it("decision 없는 응답은 그대로 통과 (decision 미존재)", () => {
    const plan = parseTravelPlan(rawWith({}));
    expect(plan).not.toBeNull();
    expect(plan?.decision).toBeUndefined();
  });

  it("decision = null 은 제거 후 통과", () => {
    const plan = parseTravelPlan(rawWith({ decision: null }));
    expect(plan).not.toBeNull();
    expect(plan?.decision).toBeUndefined();
  });

  it("decision = string 같은 잘못된 타입은 제거 후 통과", () => {
    const plan = parseTravelPlan(rawWith({ decision: "junk" }));
    expect(plan).not.toBeNull();
    expect(plan?.decision).toBeUndefined();
  });

  it("배열 원소 타입이 잘못된 필드는 빈 배열로 fallback", () => {
    const plan = parseTravelPlan(
      rawWith({
        decision: { good_reasons: [1, 2, 3], check_before_confirming: ["c"] },
      }),
    );
    expect(plan?.decision?.good_reasons).toEqual([]);
    expect(plan?.decision?.check_before_confirming).toEqual(["c"]);
  });

  it("plan 자체가 망가지면 (days 누락) 여전히 거절", () => {
    const broken = JSON.stringify({ rationale: "x", budget: { extras: [] }, caveats: [] });
    expect(parseTravelPlan(broken)).toBeNull();
  });
});

describe("parseTravelPlan — sanitize", () => {
  it("각 day 의 첫 item 의 transit 을 제거", () => {
    const raw = JSON.stringify({
      ...baseRaw,
      days: [
        {
          label: "1일",
          items: [
            { text: "출발", place_query: "성산일출봉", transit: { mode: "차량", duration_min: 30 } },
            { text: "다음", place_query: "카페 델문도", transit: { mode: "도보", duration_min: 10 } },
          ],
        },
      ],
    });
    const plan = parseTravelPlan(raw);
    expect(plan?.days[0]?.items[0]?.transit).toBeUndefined();
    expect(plan?.days[0]?.items[1]?.transit?.mode).toBe("도보");
  });

  it("공항 도착·체크인·낮잠 같은 활동의 place_query 를 빈 문자열로", () => {
    const raw = JSON.stringify({
      ...baseRaw,
      days: [
        {
          label: "1일",
          items: [
            { text: "제주공항 도착", place_query: "제주국제공항" },
            { text: "체크인", place_query: "그랜드조선" },
            { text: "성산일출봉 등반", place_query: "성산일출봉" },
          ],
        },
      ],
    });
    const plan = parseTravelPlan(raw);
    expect(plan?.days[0]?.items[0]?.place_query).toBe("");
    expect(plan?.days[0]?.items[1]?.place_query).toBe("");
    expect(plan?.days[0]?.items[2]?.place_query).toBe("성산일출봉");
  });

  it("같은 place_query 가 중복되면 두 번째부터 빈 문자열로", () => {
    const raw = JSON.stringify({
      ...baseRaw,
      days: [
        {
          label: "1일",
          items: [
            { text: "성산일출봉", place_query: "성산일출봉" },
            { text: "다시 성산", place_query: "성산일출봉" },
          ],
        },
      ],
    });
    const plan = parseTravelPlan(raw);
    expect(plan?.days[0]?.items[0]?.place_query).toBe("성산일출봉");
    expect(plan?.days[0]?.items[1]?.place_query).toBe("");
  });

  it('"제주 카페" 같은 지역+카테고리 place_query 를 generic 으로 판정해 제거', () => {
    const raw = JSON.stringify({
      ...baseRaw,
      days: [{ label: "1일", items: [{ text: "어디든 카페", place_query: "제주 카페" }] }],
    });
    const plan = parseTravelPlan(raw);
    expect(plan?.days[0]?.items[0]?.place_query).toBe("");
  });
});

describe("parseTravelPlan — robustness", () => {
  it("```json``` fence 가 붙은 응답도 파싱", () => {
    const wrapped = "```json\n" + JSON.stringify(baseRaw) + "\n```";
    expect(parseTravelPlan(wrapped)).not.toBeNull();
  });

  it("JSON 으로 파싱 안 되는 raw 는 null", () => {
    expect(parseTravelPlan("not-json")).toBeNull();
  });
});

describe("evaluateBudget", () => {
  const planForBudget: TravelPlan = {
    rationale: "x",
    days: [
      {
        label: "1일",
        items: [
          { text: "성산일출봉", place_query: "성산일출봉", cost_krw: 5000, cost_label: "입장료" },
          {
            text: "흑돼지 식당",
            place_query: "흑돈가",
            cost_krw: 60000,
            cost_label: "식사",
            transit: { mode: "차량", duration_min: 20, cost_krw: 3000 },
          },
        ],
      },
    ],
    budget: { extras: [{ label: "숙박", krw: 200000 }] },
    caveats: [],
  };

  it("requested 가 없으면 null", () => {
    expect(evaluateBudget({ activity: 0, transit: 0, extras: 0, total: 0, activityItems: [], transitItems: [] }, undefined)).toBeNull();
  });

  it("activity 합계가 5% 여유 안에 들어오면 null", () => {
    const totals = {
      activity: 65000,
      transit: 0,
      extras: 0,
      total: 65000,
      activityItems: [],
      transitItems: [],
    };
    // 5% 여유: requested 70000 → 73500 까지 OK
    expect(evaluateBudget(totals, 65000)).toBeNull();
  });

  it("activity 가 5% 초과면 BudgetCheck 반환", () => {
    const totals = {
      activity: 100000,
      transit: 0,
      extras: 0,
      total: 100000,
      activityItems: [
        { day: "1일", text: "한정식 식사", krw: 100000, label: "식사" },
      ],
      transitItems: [],
    };
    const check = evaluateBudget(totals, 50000, ["food"]);
    expect(check).not.toBeNull();
    expect(check?.requested).toBe(50000);
    expect(check?.scopedTotal).toBe(100000);
    expect(check?.overage).toBe(50000);
  });

  it("includes 배열을 존중 — food 만 보면 다른 카테고리는 제외", () => {
    const totals = {
      activity: 100000,
      transit: 30000,
      extras: 200000,
      total: 330000,
      activityItems: [{ day: "1일", text: "식사", krw: 100000, label: "식사" }],
      transitItems: [{ day: "1일", to: "다음", krw: 30000, mode: "차량", duration_min: 30 }],
    };
    const check = evaluateBudget(totals, 50000, ["food"], planForBudget);
    expect(check?.scopedTotal).toBe(100000); // 식비만
  });
});

describe("parseBudgetIncludes", () => {
  it("배열을 받으면 정상 카테고리만 남기고 dedupe", () => {
    expect(parseBudgetIncludes(["food", "food", "lodging", "invalid"])).toEqual(["food", "lodging"]);
  });

  it("빈 배열·잘못된 입력은 default 반환", () => {
    expect(parseBudgetIncludes(undefined)).toEqual(["lodging", "rental", "transport", "admission", "food"]);
    expect(parseBudgetIncludes([])).toEqual(["lodging", "rental", "transport", "admission", "food"]);
  });

  it('legacy budgetScope = "all" 은 6 카테고리 전체로 매핑', () => {
    expect(parseBudgetIncludes(undefined, "all")).toEqual([
      "lodging",
      "rental",
      "transport",
      "admission",
      "food",
      "shopping",
    ]);
  });

  it('legacy "with_transit" 은 transport·admission·food', () => {
    expect(parseBudgetIncludes(undefined, "with_transit")).toEqual(["transport", "admission", "food"]);
  });

  it('legacy "activity" 는 admission·food·shopping', () => {
    expect(parseBudgetIncludes(undefined, "activity")).toEqual(["admission", "food", "shopping"]);
  });
});

describe("normalizeTravelInput", () => {
  const valid = {
    destination: "제주",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    prompt: "조용히",
    planningModel: "balanced",
  };

  it("정상 입력은 정규화된 객체 반환", () => {
    const out = normalizeTravelInput(valid);
    expect(out?.destination).toBe("제주");
    expect(out?.startDate).toBe("2026-05-01");
    expect(out?.planningModel).toBe("balanced");
  });

  it("destination 누락 → null", () => {
    expect(normalizeTravelInput({ ...valid, destination: "" })).toBeNull();
  });

  it("end < start → null", () => {
    expect(normalizeTravelInput({ ...valid, endDate: "2026-04-30" })).toBeNull();
  });

  it("잘못된 날짜 형식 → null", () => {
    expect(normalizeTravelInput({ ...valid, startDate: "2026-13-01" })).toBeNull();
  });

  it("destination 80자 초과는 잘림", () => {
    const long = "가".repeat(200);
    const out = normalizeTravelInput({ ...valid, destination: long });
    expect(out?.destination.length).toBe(80);
  });

  it("planningModel 이 잘못되면 default(balanced) 로 fallback", () => {
    const out = normalizeTravelInput({ ...valid, planningModel: "junk" });
    expect(out?.planningModel).toBe("balanced");
  });

  it("mustVisit 입력은 dedupe·trim·길이 제한 적용", () => {
    const out = normalizeTravelInput({
      ...valid,
      mustVisit: [
        { name: "  카페 델문도  " },
        { name: "카페 델문도" }, // 동일 normalized → dedupe
        { name: "성산일출봉" },
        { name: "" }, // 빈 이름 → drop
        { name: "x".repeat(200) }, // 80자로 truncate
      ],
    });
    expect(out?.mustVisit).toHaveLength(3);
    expect(out?.mustVisit?.[0]?.name).toBe("카페 델문도");
    expect(out?.mustVisit?.[1]?.name).toBe("성산일출봉");
    expect(out?.mustVisit?.[2]?.name.length).toBe(80);
  });
});

// --- mustVisit (PR 0) ---

describe("buildTravelPrompt — mustVisit 라인", () => {
  const baseInput: TravelInput = {
    destination: "제주",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    prompt: "가족 여행",
    planningModel: "balanced",
  };

  it("mustVisit 없으면 user prompt 에 '필수 방문 장소' 라인이 없음", () => {
    const { user } = buildTravelPrompt(baseInput);
    expect(user).not.toContain("필수 방문 장소");
  });

  it("mustVisit 1개는 라인 1줄로 추가", () => {
    const { user } = buildTravelPrompt({
      ...baseInput,
      mustVisit: [{ name: "카페 델문도" }],
    });
    expect(user).toContain("필수 방문 장소");
    expect(user).toContain("- 카페 델문도");
  });

  it("mustVisit 3개는 3줄, note·주소 함께 렌더", () => {
    const { user } = buildTravelPrompt({
      ...baseInput,
      mustVisit: [
        { name: "카페 델문도", note: "오전 10시 오픈" },
        {
          name: "흑돈가 성산점",
          place: { address: "제주 서귀포시 성산읍 ..." },
        },
        { name: "성산일출봉" },
      ],
    });
    expect(user).toContain("- 카페 델문도 — 오전 10시 오픈");
    expect(user).toContain("- 흑돈가 성산점 (제주 서귀포시 성산읍 ...)");
    expect(user).toContain("- 성산일출봉");
  });
});

describe("parseTravelPlan — sanitize protectedNames (PR 0)", () => {
  const dayWith = (items: Array<{ text: string; place_query: string }>) =>
    JSON.stringify({
      rationale: "test",
      days: [{ label: "1일", items }],
      budget: { extras: [] },
      caveats: [],
    });

  it("generic suppression 패턴 ('제주 카페') 가 mustVisit 정확 일치면 보존", () => {
    const raw = dayWith([{ text: "특별한 카페", place_query: "제주 카페" }]);
    const plan = parseTravelPlan(raw, {
      mustVisit: [{ name: "제주 카페" }],
    });
    expect(plan?.days[0]?.items[0]?.place_query).toBe("제주 카페");
  });

  it("일치 안 함 (변형 — '메가덕불고기 신주쿠점' vs mustVisit '메가덕불고기') 은 보호 안 됨 (의도)", () => {
    // 이 케이스는 generic 도 아니고 중복도 아니라 sanitize 가 그대로 통과시키지만,
    // 핵심은 fuzzy fallback 이 없다는 것. exact-normalize 로만 매칭 → 변형은 mustVisitMissing.
    const plan = parseTravelPlan(
      dayWith([{ text: "식사", place_query: "메가덕불고기 신주쿠점" }]),
      { mustVisit: [{ name: "메가덕불고기" }] },
    );
    expect(plan?.mustVisitMissing).toContain("메가덕불고기");
  });

  it("같은 이름 중복은 mustVisit 으로 보호된 경우 두 번째도 빈 문자열로 만들지 않음", () => {
    const raw = dayWith([
      { text: "오전 방문", place_query: "성산일출봉" },
      { text: "오후 재방문", place_query: "성산일출봉" },
    ]);
    const plan = parseTravelPlan(raw, {
      mustVisit: [{ name: "성산일출봉" }],
    });
    expect(plan?.days[0]?.items[0]?.place_query).toBe("성산일출봉");
    expect(plan?.days[0]?.items[1]?.place_query).toBe("성산일출봉");
  });

  it("normalize 는 대소문자·공백 무시 — '카페 델 문도' 와 '카페 델문도' 동등 처리", () => {
    const plan = parseTravelPlan(
      dayWith([{ text: "카페", place_query: "카페델문도" }]),
      { mustVisit: [{ name: "카페 델문도" }] },
    );
    // exact-normalize: "카페델문도" === "카페델문도" (공백 제거 후) → 매칭
    expect(plan?.mustVisitMissing).toBeUndefined();
  });
});

describe("applyMustVisitToPlan — 좌표 보존 + mustVisitMissing", () => {
  const makePlan = (places: string[]): TravelPlan => ({
    rationale: "x",
    days: [
      {
        label: "1일",
        items: places.map((q) => ({ text: q, place_query: q })),
      },
    ],
    budget: { extras: [] },
    caveats: [],
  });

  it("mustVisit.place 가 매칭되는 day item 에 PlaceInfo 복사", () => {
    const plan = makePlan(["성산일출봉", "흑돈가 성산점"]);
    const mv: MustVisitItem[] = [
      {
        name: "흑돈가 성산점",
        place: { name: "흑돈가 성산점", lat: 33.45, lng: 126.92, address: "제주 서귀포..." },
      },
    ];
    applyMustVisitToPlan(plan, mv);
    expect(plan.days[0]?.items[1]?.place?.lat).toBe(33.45);
    expect(plan.days[0]?.items[1]?.place?.address).toBe("제주 서귀포...");
    // place 없는 mustVisit 은 day item 에 영향 X
    expect(plan.days[0]?.items[0]?.place).toBeUndefined();
  });

  it("일정에 빠진 mustVisit 은 mustVisitMissing 에 기록", () => {
    const plan = makePlan(["성산일출봉"]);
    const mv: MustVisitItem[] = [
      { name: "성산일출봉" },
      { name: "카페 델문도" },
      { name: "흑돈가 성산점" },
    ];
    applyMustVisitToPlan(plan, mv);
    expect(plan.mustVisitMissing).toEqual(["카페 델문도", "흑돈가 성산점"]);
  });

  it("모두 포함되면 mustVisitMissing 미설정", () => {
    const plan = makePlan(["성산일출봉", "카페 델문도"]);
    const mv: MustVisitItem[] = [{ name: "성산일출봉" }, { name: "카페 델문도" }];
    applyMustVisitToPlan(plan, mv);
    expect(plan.mustVisitMissing).toBeUndefined();
  });

  it("mustVisit 비어있으면 no-op", () => {
    const plan = makePlan(["성산일출봉"]);
    applyMustVisitToPlan(plan, []);
    expect(plan.mustVisitMissing).toBeUndefined();
  });

  it("normalize: '카페 델문도' (입력) ↔ '카페델문도' (LLM 출력 공백 제거) 도 매칭", () => {
    const plan = makePlan(["카페델문도"]);
    applyMustVisitToPlan(plan, [{ name: "카페 델문도" }]);
    expect(plan.mustVisitMissing).toBeUndefined();
  });
});

describe("normalizeMustVisitName", () => {
  it("공백 제거 + 소문자", () => {
    expect(normalizeMustVisitName("Cafe Delmondo")).toBe("cafedelmondo");
    expect(normalizeMustVisitName("  카페 델문도  ")).toBe("카페델문도");
    expect(normalizeMustVisitName("카페\t델 문도")).toBe("카페델문도");
  });
});
