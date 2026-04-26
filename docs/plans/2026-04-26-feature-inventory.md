# secondwind feature inventory

> Draft: 2026-04-26
> 목적: 친구들과 기능 단위로 제품을 관리하고, Codex/Claude Code 가 작업 대상을 안정적으로 식별할 수 있게 한다.

## 사용법

- 기능을 논의하거나 작업을 요청할 때는 가능하면 `TRAVEL-INPUT-01` 처럼 **Feature ID** 를 같이 적는다.
- 신규 기능은 `신규 후보`, 버그 수정과 운영 안정화는 `유지보수 후보` 에 추가한다.
- 코드 위치는 시작점이다. 실제 변경 전에는 관련 파일을 다시 읽고 현재 상태를 확인한다.
- 상태 값:
  - `live`: 사용자가 볼 수 있음
  - `partial`: 일부 동작하지만 제약이 큼
  - `planned`: TODO 또는 설계만 있음
  - `placeholder`: 자리만 있음
  - `ops`: 운영/관리 기능

## 대분류

| ID | 카테고리 | 상태 | 설명 | 주요 코드/문서 |
|---|---|---:|---|---|
| `TRAVEL` | 여행 계획 서비스 | `live` | 목적지, 기간, 요청사항을 받아 하나의 여행 계획을 만든다. | `app/(site)/travel`, `lib/common/services/travel*` |
| `DIARY` | 다이어리 서비스 | `placeholder` | 아직 제품 정의 전. | `app/(site)/diary/page.tsx` |
| `EXPERIMENT-3` | 세 번째 실험 서비스 | `placeholder` | 아직 제품 정의 전. | `app/(site)/experiment-3/page.tsx` |
| `COMMON-UI` | 공통 UI/레이아웃 | `live` | 홈, 사이트 레이아웃, 공통 카드. | `app/(site)`, `components/common` |
| `LLM-PLATFORM` | LLM 프록시/모델 운영 | `ops` | Gemini 호출, fallback, quota, prompt version. | `app/api/gemini/route.ts`, `lib/common/llm.ts` |
| `TEAM-OPS` | 팀 운영/문서/워크플로 | `live` | AGENTS, Git, gstack, 문서 규칙. | `AGENTS.md`, `PROJECT.md`, `GIT.md`, `GSTACK.md`, `docs/README.md` |

## Travel 기능 목록

### 입력과 브리핑

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-INPUT-01` | 목적지 입력 | `live` | 어디로 갈지 지정한다. | `app/(site)/travel/_components/travel-form.tsx`, `lib/common/services/travel.ts` | 국내/해외 자동 감지 | 목적지 alias 확장, 80자 제한 검증 |
| `TRAVEL-INPUT-02` | 출발/도착 날짜 입력 | `live` | 여행 기간을 지정한다. | `travel-form.tsx`, `validateTravelInput` | 당일/주말 quick preset | 날짜 역전, 잘못된 날짜 에러 카피 개선 |
| `TRAVEL-INPUT-03` | 자유 요청 textarea | `live` | 예산, 숙소, 구성원, 이동수단, 피하고 싶은 것을 적는다. | `travel-form.tsx` | structured chips 로 핵심 조건 추출 | 1000자 제한, 긴 입력 UX 점검 |
| `TRAVEL-INPUT-04` | 가이드 양식 삽입 | `live` | 빈칸이 막막한 사용자가 쉽게 시작한다. | `prompt-toolbar.tsx` | 팀 dogfooding 후 양식 항목 조정 | 기존 입력 덮어쓰기 confirm 문구 점검 |
| `TRAVEL-INPUT-05` | 예시 프롬프트 | `live` | 아이 동반, 부모님, 커플 등 상황별 예시를 제공한다. | `prompt-toolbar.tsx` | 실제 사용자 케이스 기반 예시 추가 | 예시가 너무 길어 1000자 제한에 걸리지 않는지 확인 |
| `TRAVEL-INPUT-06` | 추천 방식 선택 | `live` | 빠른 추천/균형형/장소 정확도 우선 중 고른다. | `travel-form.tsx`, `travel.ts`, `travel-planners.ts` | 선택 결과 예상 소요시간 표시 | 각 모드의 실제 품질 차이 eval |
| `TRAVEL-INPUT-07` | 입력값 검증 | `live` | 빠진 값이나 잘못된 날짜를 즉시 안내한다. | `validateTravelInput`, `friendlyErrorMessage` | field-level 에러 표시 | 클라이언트/서버 검증 메시지 일치 |

### 계획 생성과 LLM

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-PLAN-01` | Gemini 기반 일정 생성 | `live` | 하나의 확정 여행안을 받는다. | `app/api/gemini/route.ts`, `travel-planners.ts`, `llm.ts` | streaming 진행 상태 | timeout, upstream 오류 재시도 정책 점검 |
| `TRAVEL-PLAN-02` | JSON schema 기반 응답 제약 | `live` | 일정 데이터가 UI에서 안정적으로 렌더링된다. | `TRAVEL_PLAN_SCHEMA`, `parseTravelPlan` | schema version 기록 | schema 변경 시 공유 링크 호환 확인 |
| `TRAVEL-PLAN-03` | 시스템 프롬프트 | `live` | 식사, 이동, 비용, caveat 등 일정 품질 기준을 강제한다. | `SYSTEM_PROMPT` in `travel.ts` | prompt version별 changelog | 프롬프트 수정 후 골든셋 eval |
| `TRAVEL-PLAN-04` | 계획 sanitize | `live` | 공항 도착, 체크인, 조식 같은 비장소 활동을 지도 대상에서 뺀다. | `sanitizeGeneratedPlan`, `shouldSuppressPlaceQuery` | rule 설명을 debug panel 에 노출 | suppress 규칙 과잉/누락 테스트 |
| `TRAVEL-PLAN-05` | 중복 장소 제거 | `live` | 같은 장소가 반복 마커로 뜨는 것을 줄인다. | `suppressRepeatedPlaceQueries` | 같은 장소 재방문 의도 감지 | 중복 제거가 실제 재방문을 지우는지 확인 |
| `TRAVEL-PLAN-06` | 빠른 추천 모드 | `live` | 장소가 풍성한 초안을 빠르게 받는다. | `PLANNER_CONFIG.classic` | “초안” 배지/주의 표시 | hallucination 비율 측정 |
| `TRAVEL-PLAN-07` | 균형형 모드 | `live` | 일정 완성도와 장소 정확도를 같이 챙긴다. | `PLANNER_CONFIG.balanced` | repair pass 성공률 표시 | repair 비용/지연 시간 점검 |
| `TRAVEL-PLAN-08` | 장소 정확도 우선 모드 | `live` | 검증된 장소 위주의 보수적 일정을 받는다. | `PLANNER_CONFIG.verified` | 후보 선택 근거 표시 | 빈 place_query 가 너무 많아지는지 측정 |
| `TRAVEL-PLAN-09` | 모델 fallback | `live` | primary 모델이 막히면 fallback 모델로 시도한다. | `GEMINI_MODELS`, `callLlm` | 모델별 품질 비교 | 429/503 외 오류 fallback 여부 재검토 |
| `TRAVEL-PLAN-10` | kill switch | `live` | 장애나 비용 문제 때 Gemini 호출을 끈다. | `env.geminiDisabled`, `callLlm` | 관리자용 상태 표시 | 점검 메시지 사용자 친화성 |

### 장소 검증과 지도 데이터

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-PLACE-01` | Naver Local Search enrich | `live` | 장소명에 주소, 전화, 좌표, 링크를 붙인다. | `travel-enrich.ts` | 장소 출처 badge | Naver API 장애/timeout fallback |
| `TRAVEL-PLACE-02` | 목적지 hint 검색 | `live` | “제주 카페명” 처럼 목적지에 맞는 후보를 찾는다. | `buildSearchQuery`, `DESTINATION_ALIASES` | alias 관리 문서화 | 국내 도시 alias 확장 |
| `TRAVEL-PLACE-03` | 후보명 유사도 선택 | `live` | 엉뚱한 검색 결과를 줄인다. | `overlapScore`, `pickBest` | 점수 debug 로그 | threshold 0.25 재검토 |
| `TRAVEL-PLACE-04` | 카테고리 mismatch 거절 | `live` | 관광지인데 다른 업종으로 잡히는 오류를 줄인다. | `categoryMatchesQuery` | 카테고리별 허용표 | landmark regex 확장 |
| `TRAVEL-PLACE-05` | 목적지 mismatch 거절 | `live` | 목적지 밖의 동명 장소를 막는다. | `addressMatchesDestination` | 다지역 여행 허용 | 주소 없는 후보 처리 정책 |
| `TRAVEL-PLACE-06` | day outlier 거절 | `live` | 같은 날짜 장소들과 지나치게 먼 좌표를 제외한다. | `rejectDayOutliers` | 지도에서 outlier 설명 표시 | 120km 기준 조정 |
| `TRAVEL-PLACE-07` | repair pass | `live` | 실패한 장소명을 LLM으로 한 번 고친다. | `repairPlaceQueries` | repair 전후 diff 표시 | 추가 LLM 호출 비용 관리 |
| `TRAVEL-PLACE-08` | candidate pass | `live` | 지도 후보 중에서 LLM이 활동에 맞는 후보를 고른다. | `selectVerifiedCandidates` | 후보 선택 UI/감사 로그 | 후보 목록 밖 생성 방지 확인 |
| `TRAVEL-PLACE-09` | 장소 검증 통계 | `live` | 몇 개 장소가 확인됐는지 한눈에 본다. | `PlaceStats`, `computePlaceStats`, `PlanCard` | warning 상세 요약 | 통계가 사용자에게 불안만 주는지 카피 점검 |

### 결과 화면과 결정 지원

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-RESULT-01` | 요약 pill | `live` | 일정 기간, 장소 수, 예상 경비를 먼저 본다. | `PlanCard`, `SummaryPill` | 동행자/이동수단 요약 | 장소 수 기준 검증 |
| `TRAVEL-RESULT-02` | rationale 표시 | `live` | 왜 이런 일정인지 이해한다. | `PlanCard`, `SYSTEM_PROMPT` | 미충족 요청 highlight | 과장된 rationale 방지 |
| `TRAVEL-RESULT-03` | 숙소 기준점 표시 | `live` | 숙소 중심 동선을 파악한다. | `plan.stay`, `PlanCard`, `travel-enrich.ts` | 숙소 변경 후 재계산 | 숙소명 오검증 방지 |
| `TRAVEL-RESULT-04` | 결정 패널 | `live` | 좋은 점, 확인 필요, 확정 후 할 일을 빨리 판단한다. | `DecisionPanel`, `buildDecisionSummary` | 확정 전 공유/체크 흐름 | fallback summary 품질 점검 |
| `TRAVEL-RESULT-05` | 확정 버튼/localStorage | `live` | 이 브라우저에서 결정 완료 상태를 기억한다. | `confirmPlan`, `buildConfirmationKey` | 확정 히스토리 | shared page 에서 key 충돌 확인 |
| `TRAVEL-RESULT-06` | 일자별 일정 카드 | `live` | 시간순으로 장소와 활동을 본다. | `ItemCard`, `PlanCard` | drag reorder, 삭제 | details/summary 모바일 UX |
| `TRAVEL-RESULT-07` | 장소 상세 | `live` | 주소, 전화, 분류, 추천 메뉴, 비용을 펼쳐 본다. | `ItemCard` | 영업시간/메뉴 실측 보강 | AI 추정값과 검증값 구분 |
| `TRAVEL-RESULT-08` | 지도 검색 버튼/팝업 | `live` | 장소를 카카오맵에서 확인한다. | `ItemCard`, `PlacePopup`, `kakaoMapSearchUrl` | 길찾기 deep link | 모바일 앱 deep link 혼선 재점검 |
| `TRAVEL-RESULT-09` | 위치 확인 필요 badge | `live` | 검증 실패 장소를 방문 전 확인한다. | `place_warning`, `ItemCard` | warning filter | warning 문구가 너무 길지 않게 정리 |
| `TRAVEL-RESULT-10` | 정보 출처/정확도 legend | `live` | AI 추정값과 확인된 값을 구분한다. | `SourcesLegend`, `Estimated` | 출처별 아이콘 | 실제 검증 범위와 카피 일치 |

### 이동, 경로, 비용

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-MAP-01` | Kakao 지도 렌더링 | `live` | 전체 동선을 지도에서 본다. | `map-view.tsx`, `lib/common/kakao.ts` | 지도 lazy loading | Kakao app key/도메인 의존성 |
| `TRAVEL-MAP-02` | 일정별 마커 번호 | `live` | 카드와 지도 위치를 매칭한다. | `enumeratePoints`, `MapView`, `ItemCard` | 마커 클릭 시 카드 focus | 번호가 많은 일정에서 가독성 |
| `TRAVEL-MAP-03` | 일자별 색상 | `live` | 여러 날의 동선을 구분한다. | `DAY_COLORS` | 색상 legend 개선 | 접근성 contrast |
| `TRAVEL-MAP-04` | 숙소 마커 | `live` | 숙소 기준점을 지도에 표시한다. | `MapView`, `plan.stay` | 숙소-일정 거리 표시 | 숙소 좌표 실패 시 안내 |
| `TRAVEL-MAP-05` | OSRM 도로 경로 | `partial` | 차량 이동은 직선보다 실제 도로에 가깝게 본다. | `fetchRouteGeometry`, `OSRM_URL` | provider 교체/자체 호스팅 | public demo rate limit |
| `TRAVEL-MAP-06` | 직선 fallback | `live` | 경로 API 실패 시에도 최소 동선은 본다. | `MapView` | 실패 원인별 안내 | 일부 도로/일부 직선 표시 확인 |
| `TRAVEL-MAP-07` | 이동 row | `live` | 장소 사이 이동수단, 시간, 비용을 본다. | `TransitRow`, `TransitInfo` | 대중교통 지원 표시 | 첫 item 제외 transit 누락 eval |
| `TRAVEL-MAP-08` | OSRM 시간/거리 덮어쓰기 | `partial` | 차량/택시 이동은 LLM 추정보다 실제 도로 거리·시간을 쓴다. | `TransitRow`, `isCarMode` | mode별 profile 분기 | 자동차 외 mode 에 잘못 덮어쓰지 않기 |
| `TRAVEL-BUDGET-01` | 예상 총 경비 | `live` | 활동, 식사, 이동, 기타 비용 합계를 본다. | `computeBudget`, `BudgetSection` | 1인당/전체 toggle | 비용 누락/중복 계산 |
| `TRAVEL-BUDGET-02` | 비용 세부 내역 | `live` | 어떤 항목 때문에 비용이 나왔는지 펼쳐 본다. | `BudgetSection` | CSV/share export | 긴 항목 truncate UX |

### 공유와 복원

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-SHARE-01` | 공유 링크 생성 | `live` | 만든 일정을 친구에게 보낸다. | `ShareSection`, `app/api/travel/share/route.ts` | 카카오톡 공유 버튼 | KV 미설정 에러 안내 |
| `TRAVEL-SHARE-02` | Upstash 7일 TTL 저장 | `live` | 링크가 짧고 같은 화면으로 복원된다. | `travel-share-store.ts` | LZ-string query fallback | TTL 정책 문서화 |
| `TRAVEL-SHARE-03` | 공유 페이지 복원 | `live` | 받은 링크에서 입력값과 결과를 다시 본다. | `app/(site)/travel/[shareId]/page.tsx` | 공유받은 일정에서 바로 수정 생성 | 만료/잘못된 ID UX |
| `TRAVEL-SHARE-04` | 클립보드 복사 | `live` | 링크를 바로 복사한다. | `ShareSection` | 복사 실패 시 manual select | Safari/모바일 clipboard 이슈 |
| `TRAVEL-SHARE-05` | 공유 snapshot validation | `live` | 오래된/잘못된 데이터로 화면이 깨지지 않는다. | `parseSnapshot`, `isTravelPlan`, `normalizeTravelInput` | snapshot schema version | schema 변경 시 과거 링크 호환 |

### 피드백과 학습 루프

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-FEEDBACK-01` | 사용자 피드백 및 버그리포트 | `live` | 사용자가 현재 여행 계획 결과에 대한 품질 피드백이나 버그를 남기고, 팀은 입력값·결과값·화면 맥락을 함께 분석해 개선한다. | `PlanCard` feedback UI, `app/api/travel/feedback/route.ts`, `app/api/travel/feedback/admin/route.ts`, `travel-feedback-store.ts`, `scripts/fetch-feedback.mjs`, `.agents/skills/feedback/`, `docs/feedback/` | 정기 분석 문서화, GUI 관리자 화면 (현재는 CLI/skill 로 충분) | 저장 기간/열람 권한, 민감정보 마스킹 범위 확장, feedback schema version, admin token 회전 운영 |

### 운영, quota, 품질

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-OPS-01` | quota debug panel | `partial` | 개발 중 모델 사용량과 차단 상태를 본다. | `QuotaDebug`, `app/api/quota/route.ts`, `quota-store.ts` | 관리자 전용 토글 | 공개 UI 에 남길지 제거할지 결정 |
| `TRAVEL-OPS-02` | 429 cooldown | `live` | 반복 제출로 quota를 더 소모하지 않는다. | `travel-form.tsx`, `friendlyErrorMessage` | 실제 retry-after 표시 | cooldown 시간이 실제 제한과 맞는지 |
| `TRAVEL-OPS-03` | blocked model skip | `live` | 이미 막힌 모델 호출을 건너뛴다. | `getBlockedModels`, `markBlocked`, `callLlm` | dashboard 표시 | KV 실패 시 graceful degradation |
| `TRAVEL-OPS-04` | prompt/eval 골든셋 | `planned` | 프롬프트 수정 회귀를 잡는다. | `scripts/eval-travel.mjs`, `TODOS.md` | 5~10개 대표 입력 snapshot | 모델 업데이트 후 수동 실행 |
| `TRAVEL-OPS-05` | hallucination 방어 | `planned` | 존재하지 않는 장소 추천을 줄인다. | `TODOS.md`, `travel-enrich.ts` | 2-phase candidate pool | P1 로 관리, dogfooding feedback 수집 |
| `TRAVEL-OPS-06` | Kakao 의존성 해결 | `planned` | 지도 장애 리스크를 줄인다. | `TODOS.md`, `MapView` | 커스텀 도메인/Mapbox/Leaflet 검토 | borrowed Kakao app key 리스크 |
| `TRAVEL-OPS-07` | CI build gate | `planned` | PR에서 type/lint/build 회귀를 잡는다. | `TODOS.md`, `.github/workflows` | GitHub Actions 추가 | 비개발자 팀원에게 위험 설명 필수 |
| `TRAVEL-OPS-08` | Dogfooding gate | `planned` | 실제 사용자 문제인지 검증한다. | `PROJECT.md`, `TODOS.md`, ADR 0001 | 2026-05-06 전 실제 여행 입력 확보 | 실패 시 travel-first 재검토 |

## Diary 후보 목록

| Feature ID | 기능 | 상태 | 설명 | 다음 질문 |
|---|---|---:|---|---|
| `DIARY-CORE-01` | 일기 작성 | `placeholder` | 아직 기능 정의 전. | 여행 후 회고인지, 매일 쓰는 감정 기록인지? |
| `DIARY-CORE-02` | AI 요약/회고 | `placeholder` | secondwind 의 다른 서비스와 연결 가능. | 여행 계획과 이어지는 기록인가? |
| `DIARY-CORE-03` | 공유/비공개 설정 | `placeholder` | 민감한 개인 데이터가 될 수 있음. | 저장소와 privacy 기준은? |

## Experiment-3 후보 목록

| Feature ID | 기능 | 상태 | 설명 | 다음 질문 |
|---|---|---:|---|---|
| `EXPERIMENT-3-CORE-01` | 세 번째 서비스 정의 | `placeholder` | 아직 이름과 문제 정의가 없음. | travel/diary 와 같은 플랫폼에 둘 이유가 있는가? |
| `EXPERIMENT-3-CORE-02` | 실험 종료/삭제 판단 | `placeholder` | 자리만 있는 서비스가 혼란을 만들 수 있음. | 유지할지, 숨길지, 제거할지? |

## 팀 운영용 추천 흐름

1. 회의 전에 이 문서에서 각자 관심 있는 Feature ID 1~3개를 고른다.
2. 회의에서는 각 Feature ID 마다 `유지`, `개선`, `보류`, `삭제` 중 하나로 판단한다.
3. 개발 작업은 Feature ID 하나를 기준으로 작은 PR 을 만든다.
4. 비개발자 dogfooding 은 `입력값`, `기대한 결과`, `실제 결과`, `관련 Feature ID` 로 기록한다.
5. 기능이 shipped 되면 이 문서의 상태와 후보 목록을 갱신한다.
