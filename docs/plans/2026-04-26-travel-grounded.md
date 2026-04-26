# Travel — 지도 후보 기반(grounded) 추천 모델

작성: 2026-04-26
상태: 구현 진행 중
관련: ADR 0001 Risk #3 (LLM hallucination), TODOS.md P1 "Hallucination 방어 (grounding)", `docs/plans/2026-04-25-travel-planning-models.md`

---

## 배경

`/travel` 의 장소 정확도 문제가 오랫동안 누적돼 있다. 지금까지 시도한 개선 (3개 추천 모델 분리, repair pass, candidate pass, sanitizer, outlier reject) 은 모두 **LLM 이 먼저 만들고 → Naver 가 사후 검증** 하는 패러다임이었다. 이 패러다임의 한계:

- LLM 이 모르거나 환각하면, 검증으로 잡혀도 `place_warning` 만 남고 사용자는 가짜 상호명을 본다. "검증 실패가 많다" 자체가 신뢰 시그널을 떨어뜨림.
- `verified` 모델만 후보 검수 (`selectVerifiedCandidates`) 로 grounded. **default 인 `balanced` 는 repair pass — 다시 LLM 에게 만들라고 하는 거라 같은 환각 함정 재진입.**
- 매칭 임계값 `MIN_SCORE = 0.25` 는 관대해 false positive (잘못 매칭됐는데 warning 안 뜸) 가 가장 위험한 실패가 됨.

추천 방식이 이미 추상화돼 있으니 (`PlanningModel`, `PLANNER_CONFIG`), 새 모델로 grounded generation 을 도입한다.

---

## 스코프

### 새 모델: `grounded`

라벨: **지도 후보 기반**. 한 줄 설명: "사용자 요청에서 키워드를 뽑아 지도 후보 풀을 먼저 만들고, 그 안에서만 장소를 고릅니다."

흐름:

```
사용자 입력
  → extractSeeds() : 목적지 기본 카테고리 + 페르소나 힌트 + 음식 키워드
  → collectPoolFromSeeds() : 시드별 Naver 검색으로 30~50개 POI 풀 (좌표/주소/카테고리 포함)
  → user prompt 끝에 [후보 풀] 섹션 첨부
  → LLM 단일 호출 (temperature 0.2, "place_query 는 풀의 name 과 정확히 같은 문자열만")
  → applyPoolToPlan() : 풀 외부 query 모두 빈 문자열, 풀 내부는 PlaceInfo 직접 채움 (Naver 재호출 없음)
  → rejectDayOutliers()
```

### 핵심 차이점

| 항목 | 기존 `verified` | 새 `grounded` |
|---|---|---|
| 후보 풀 수집 시점 | 1차 생성 후 (사후) | 1차 생성 **전** (사전) |
| LLM 호출 수 | 2회 (생성 + 검수) | **1회** |
| 풀 외부 장소 처리 | 빈 문자열로 정리 | 동일 |
| 풀 내부 장소 좌표 | Naver 재검색으로 enrich | 풀에서 직접 채움 (검색 0회) |
| 매칭 임계값 의존 | `MIN_SCORE = 0.25` | 없음 (이름 정확 일치만) |
| 메뉴/가격 환각 | 보통 | 보수화 (확신 없으면 생략 지시) |

### 기존 모델 변경하지 않음

`classic` / `balanced` / `verified` 의 동작은 유지. 사용자가 명시적으로 새 모델을 선택할 때만 grounded 동작.

다음 PR 에서 eval 결과 확인 후 default 변경 (balanced → grounded) 검토.

---

## 구현 계획

### 1) 타입 / metadata

`lib/common/services/travel.ts`:
- `PlanningModel` 에 `"grounded"` 추가
- `PLANNING_MODELS` 에 항목 추가 (UI 자동 노출)
- `parsePlanningModel` 업데이트 (공유 링크 호환)

### 2) 시드 추출 + 풀 수집 모듈

`lib/common/services/travel-grounded.ts` (신규):
- `extractSeeds(input)`: 목적지 기본 카테고리(관광지/맛집/카페) + 페르소나 힌트(아이/부모님 → 키즈카페/전망 식당) + 음식 키워드(회/돼지국밥/흑돼지/고기국수 등) → 시드 8개 이내
- `collectPoolFromSeeds(seeds, destination, perSeedLimit=5)`: 시드별 `searchPlaceCandidates` 호출 → 이름 단위 dedupe → `PoolEntry[]` (~30개)
- `applyPoolToPlan(plan, poolMap)`: 풀 외부 query 정리, 풀 내부는 lat/lng/address/category 직접 채움
- `appendPoolToPrompt(userPrompt, pool)`: user prompt 끝에 `[후보 풀]` 라인 첨부

### 3) Planner 분기

`lib/common/services/travel-planners.ts`:
- `PlannerConfig` 에 `groundedSeeds: boolean` 추가
- `PLANNER_CONFIG.grounded`: temperature 0.2, groundedSeeds true, 다른 패스(repair/candidate) 없음
- `runTravelPlanner` 분기:
  - 시드 추출 + 풀 수집 → user prompt 에 풀 첨부
  - 풀이 비어 있으면(Naver 키 없음 등) 일반 흐름으로 fallback
  - 응답 파싱 후 `applyPoolToPlan` → `rejectDayOutliers`
  - `enrichPlan` 호출 안 함 (풀에서 좌표 이미 받음)

### 4) System prompt 분기

`planningModelInstruction("grounded")` 에:
- "place_query 는 풀의 name 과 정확히 같은 문자열만"
- "풀 밖 장소는 검수 단계에서 모두 제거"
- "각 day 3~5개. recommended_menu / cost_krw 는 확신 없으면 생략"

### 5) Eval

`scripts/eval-travel.mjs` 의 `PLANNING_MODELS` 에 `grounded` 추가. 기존 골든셋 3개에서 자동 측정.

---

## 트레이드오프 / 의식적으로 안 하는 것

1. **풀 수집 비용**: 시드 8개 × `searchPlaceCandidates` (Naver 호출 1회) = 약 8회 Naver 호출. 단일 LLM 호출 + 적은 enrich 호출 (verified 의 candidate pass 와 비슷한 비용) 이므로 허용. Naver API 무료 티어 제한 (일 25k 호출) 안에 들어옴.
2. **단일 패스라서 LLM 이 풀을 무시할 위험**: post-processing(`applyPoolToPlan`) 에서 풀 외부는 무조건 빈 문자열로 만들기 때문에 안전. 다만 LLM 이 풀을 잘 활용하지 못하면 일정이 빈 place_query 로 가득할 수 있음 → eval 로 측정.
3. **MIN_SCORE 글로벌 상향은 이번 PR 에서 안 함**: `searchPlace` 의 `MIN_SCORE = 0.25` 상향은 기존 모델 (classic/balanced/verified) 의 회귀 위험이 있어 별도 PR 로 측정 후 적용. grounded 는 매칭 임계값에 의존하지 않으므로 영향 없음.
4. **메뉴/영업시간 외부 검증 (Google Search grounding 등) 은 다음 단계**: 이번 PR 은 상호명 grounding 만. 메뉴/가격은 system prompt 에서 보수화 지시만 추가.
5. **eval baseline 측정은 PR merge 후**: Gemini 쿼터 복구 대기 중. merge 후 4개 모델 모두 측정해서 다음 PR 의 default 선택 근거로 사용.

---

## 사용자가 보게 될 변화

- `/travel` "선택 옵션 → 추천 방식" 에 4번째 카드 "지도 후보 기반" 추가.
- 선택 시: 결과 카드의 일정 항목들이 풀 안에서 검증된 장소로만 채워지고, 일부 활동은 `place_query` 가 비어 있을 수 있음 (의도된 동작).
- 결과 카드의 "확인 필요" 카운트가 다른 모델보다 낮을 가능성이 높음 — 매칭 임계값에 의존하지 않으므로 false positive 줄음.

---

## 검증

1. typecheck / lint / build 통과.
2. (PR merge 후) `npm run eval:travel --models grounded` 실행하고 snapshot 비교:
   - `verifiedPlaces / totalPlaceQueries` 비율이 기존 모델보다 높거나 비슷한지
   - `warnings` 가 의미 있게 줄었는지
   - `repairedPlaces` 는 항상 0 (grounded 는 repair pass 없음)
3. 실제 `/travel` 에서 "제주 가족", "부산 차 없이", "강릉 부모님" 골든셋 입력으로 수동 확인.

---

## 후속 (이 PR 다음)

- eval 결과 기반 default 모델 결정 (`DEFAULT_PLANNING_MODEL` 변경 후보).
- `MIN_SCORE` 0.25 → 0.40 글로벌 상향 (별도 PR).
- 메뉴/영업시간 검증 옵션 검토 (Gemini Google Search grounding vs Naver 블로그 검색).
- Eval CI 통합 (weekly cron 으로 회귀 자동 감지).
