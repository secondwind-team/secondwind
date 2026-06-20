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
| `FINZ` | 친구 기반 투자 대화 메신저 | `live` | **계정·핸들 기반 4탭 메신저**(친구·대화·피드·프로필). 대화방에서 캐릭터로 만나 우정주·한 줄 입장·AI 요약을 나누고, 각 방의 AI 봇 `@finz` 가 멘션을 **의도 분류**해 답변·차트·시황 브리핑·선제 개입을 실행. 기존 1인 솔로·파티 흐름은 메신저로 흡수. | `app/finz/`, `lib/server/finz-*`, `lib/common/services/finz*`, `docs/finz/DESIGN.md` (IA·아키텍처) |
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
| `TRAVEL-PLAN-02` | JSON schema 기반 응답 제약 | `live` | 일정 데이터가 UI에서 안정적으로 렌더링된다. | `TRAVEL_PLAN_SCHEMA`, `parseTravelPlan` | schema version 기록 | schema 변경 시 공유 링크 호환 확인, ✅ invalid-response 메시지 사용자 친화화 (피드백 40DagbST) |
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

### 장소 컬렉션 (내 장소)

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-PLACES-01` | 리스트 CRUD | `planned` | 사용자가 만든 그룹별로 장소를 모은다 ("제주 다음달", "근처맛집"). | `app/(site)/travel/places/`, `lib/common/services/places.ts`, `places-storage.ts`, `docs/plans/2026-04-29-my-places.md` | 정렬·검색 (리스트 많아지면) | localStorage 5MB 도달 시 UX |
| `TRAVEL-PLACES-02` | 장소 텍스트 추가 / CRUD | `planned` | 평소에 들은 장소를 텍스트로 모아둔다. | `app/(site)/travel/places/[listId]/`, `places-storage.ts` | 메모·태그 확장 | 동일 이름 dedup, JSON 손상 복구 |
| `TRAVEL-PLACES-03` | AI 장소 매칭 (개별 + 일괄) | `planned` | 텍스트로 적은 장소를 Naver 와 매칭해 주소·전화·좌표 채움. | `app/api/places/resolve/route.ts` (신규), `lib/common/services/travel-enrich.ts` 의 `searchPlaceCandidates` 재사용 | 후보 자동 우선순위 학습 | hard quota 도입 시점 |
| `TRAVEL-PLACES-04` | 여행 계획에 must-visit 주입 | `partial` | "이 장소들은 반드시 가야 함" 을 LLM 에 강제. Phase 0' textarea 는 구현됨, 내 장소 모달 연동은 gate 이후. | `lib/common/services/travel.ts` (mustVisit, buildTravelPrompt, sanitize protectedNames, 좌표 보존, mustVisitMissing), `lib/common/services/travel-grounded.ts` (풀 우선 삽입), `app/(site)/travel/_components/travel-form.tsx`, `scripts/eval-travel.mjs` | per-place hint override, 내 장소 모달/칩으로 textarea 교체 | `npm run eval:travel -- --ab-mustvisit` gate, mustVisit 누락률 모니터링 |
| `TRAVEL-PLACES-05` | 외부 앱 share_target | `planned` | 카카오·네이버·구글맵에서 공유 → secondwind 로 자동 추가. | (PWA manifest 필요, 미구현) | — | PWA blocker 와 묶음 |
| `TRAVEL-PLACES-06` | 인앱 지도 picker | `planned` | 카카오맵으로 직접 탐색해서 장소 추가. | `app/(site)/travel/places/_components/` (별도 plan) | stay-picker 와 다중 선택 통합 | Kakao 의존성 강화 검토 |
| `TRAVEL-PLACES-07` | 동기화 (KV / device-id) | `planned` | 같은 폰에서 브라우저 캐시 지워도 데이터 보존. | `lib/server/places-storage-kv.ts` (미구현, StorageAdapter 인터페이스로 무수정 교체) | 익명 device-id 쿠키 정책 | 마이그레이션 hook (`exportSnapshot`/`importSnapshot`) |
| `TRAVEL-PLACES-08` | 리스트 공유 링크 | `planned` | 친구에게 "근처맛집" 리스트 공유. | `app/api/places/share/` (미구현) | TRAVEL-SHARE 패턴 재사용 | -07 동기화 선행 |

### 운영, quota, 품질

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `TRAVEL-OPS-01` | quota debug panel | `partial` | 개발 중 모델 사용량과 차단 상태를 본다. | `QuotaDebug`, `app/api/quota/route.ts`, `quota-store.ts` | 관리자 전용 토글 | 공개 UI 에 남길지 제거할지 결정 |
| `TRAVEL-OPS-02` | 429 cooldown | `live` | 반복 제출로 quota를 더 소모하지 않는다. | `travel-form.tsx`, `friendlyErrorMessage` | 실제 retry-after 표시 | cooldown 시간이 실제 제한과 맞는지 |
| `TRAVEL-OPS-03` | blocked model skip | `live` | 이미 막힌 모델 호출을 건너뛴다. | `getBlockedModels`, `markBlocked`, `callLlm` | dashboard 표시 | KV 실패 시 graceful degradation |
| `TRAVEL-OPS-04` | prompt/eval 골든셋 | `partial` | 프롬프트 수정 회귀를 잡는다. 기본 골든셋과 mustVisit A/B 모드는 있음, 운영 snapshot 축적은 아직 수동. | `scripts/eval-travel.mjs`, `TODOS.md` | 5~10개 대표 입력 snapshot 확장 | 모델 업데이트 후 수동 실행, snapshot 저장 위치/판정 기준 정례화 |
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

## FINZ 기능 목록

> 2026-06-20 갱신: finz 가 **계정·핸들 기반 4탭 메신저**로 ship 됨(PR #107·#109). 이어 `@finz` 가 **의도 분류 라우터**로 진화하고 **종목 차트(TradingView)**·**정기 브리핑(GH Actions cron)**·**대화 진입 성능(SSR·서울 리전)**이 추가됨(CHANGELOG `[0.1.21.1]~[0.1.24.0]`). 아래는 그 기준의 기능 목록(Travel 과 동일한 7열 포맷). 옛 `FINZ-MVP-01~06` 계획 ID(2026-05-24·2026-06-13 plan)는 이 목록으로 **대체**됨 — 매핑은 각 행 끝에 표기. IA·아키텍처는 `docs/finz/DESIGN.md`.

### 계정·온보딩

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-ACCT-01` | 계정·핸들 (finz 소유) | `live` | Google 로그인은 인증만, 핸들·프로필은 finz 가 관리. 친구가 `@핸들`로 나를 찾는다. provider-agnostic(추후 다른 로그인 귀속). | `lib/server/finz-account-store.ts`(Neon `finz_accounts`/`finz_auth_links`), `lib/server/finz-account.ts`, `app/api/finz/account/route.ts` (+`/handle`) | 다른 로그인(카카오·애플) 추가 | 핸들 변경 히스토리, 계정 삭제/탈퇴 |
| `FINZ-ACCT-02` | 온보딩 + 게이트 | `live` | 첫 로그인 → 핸들(+표시이름)만 정하면 시작. 미로그인/계정없음/정상을 게이트가 분기. | `finz-onboarding`, `finz-app-gate`, `finz-account-context`, `finz-login-view` | 핸들 추천, 프로필 사진 | store 미설정/네트워크 실패 graceful |

### 친구

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-FRIEND-01` | 핸들로 친구 추가·요청·수락 | `live` | `@핸들`로 친구 요청, 상대도 보내면 즉시 친구. 받은/보낸 요청·목록. 친구 행에서 1:1 대화 시작. | `app/finz/(tabs)/friends/page.tsx`, `app/api/finz/friends/route.ts`, `finz-account-store`(`finz_friendships`) | 친구 검색·추천, 차단 | 요청 스팸 제한, 상대 계정 삭제 시 정리 |

### 대화

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-CHAT-01` | 대화방 목록 + 새 대화(1:1/그룹) | `live` | 내 대화방을 최근 활동순으로 보고, 친구와 1:1 또는 그룹방을 만든다. (기존 "파티" 흡수.) | `app/finz/(tabs)/chats/page.tsx`, `finz-new-chat-sheet`, `app/api/finz/rooms/route.ts`, `finz-group-store`(방 인덱스 ZSET) | 검색·핀·읽음 표시 | 목록 로딩 성능(병렬화 완료), 1:1 중복방 dedup |
| `FINZ-CHAT-02` | 대화방 타임라인 | `live` | append-only 채팅(텍스트·우정주·입장·요약·차트·시스템). 폴링(보임 3s/숨김 8s)·낙관적 전송. 방 목록은 SSR 시드(왕복 절감, `FINZ-OPS-02`). | `app/finz/party/[groupId]`, `finz-party-room`, `finz-chat-*`, `app/api/finz/party/[groupId]/{message,chat}`, `finz-chat-store` (`FINZ-MVP-03`) | 실시간(SSE/WS) | LTRIM 도입 시 incr-seq 전환, 400 ceiling |
| `FINZ-CHAT-03` | 친구 초대 / 링크 합류 | `live` | 방에서 친구를 골라 초대하거나 링크로 누구나 합류(원탭, 취향 재선택 없음). | `app/api/finz/rooms/[groupId]/{invite,join}`, `finz-invite-sheet`, `finz-room-join-view`, `finz-room-full-notice` | 초대 권한·승인, QR | memberId(=accountId) 위조 방어 강화 |
| `FINZ-CHAT-04` | 나와의 채팅 (self) | `live` | 계정당 1개 혼자 방 — 메모 + `@AI`·선제 개입 솔로 테스트(사람 안 모아도 됨). | `app/api/finz/rooms/self/route.ts`, `finz-group-store`(`getOrCreateSelfRoom`, `sw:finz:self:<id>`) | self 에서도 가능한 콘텐츠 확대 | 우정주는 2인 필요라 비활성(의도) |

### 피드·프로필

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-FEED-01` | 친구 활동 피드 | `live` | 친구의 활동(가입·캐릭터 소환·우정주 생성·방 개설)을 SNS 타임라인처럼 본다. | `app/finz/(tabs)/feed/page.tsx`, `finz-feed-list`, `app/api/finz/feed/route.ts`, `finz-account-store`(`finz_feed_events`, fan-in) | 좋아요·댓글, 챌린지 이벤트 | 친구 많아지면 fan-in→fan-out, 이벤트 보존기간 |
| `FINZ-PROFILE-01` | 프로필 (캐릭터·편집·이력) | `live` | 캐릭터 카드 + 핸들·이름·소개·취향 편집 + 가입 이력 + 로그아웃. 캐릭터 없으면 소환 CTA. | `app/finz/(tabs)/profile/page.tsx`, `finz-profile-view`, `finz-character-card` | 활동 통계, 캐릭터 성장 | 편집 검증(핸들 0개/3+개 캐릭터) |

### 캐릭터·콘텐츠 (대화방 안 부가기능)

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-CHAR-01` | 취향 카드 → 캐릭터 소환 | `live` | 취향 카드 3개+로 미래기술 딜러·배당 힐러 등 캐릭터·스탯을 deterministic 생성(가입 후 프로필에서). | `lib/common/services/finz.ts`(`summonFinzCharacter`·`FINZ_TASTE_CARDS`), `finz-character-builder` (`FINZ-MVP-01·02`) | AI 문장 다듬기, 아바타 이미지 | 카탈로그 변경 내성(렌더 시 재구성) |
| `FINZ-PICK-01` | 우정주 생성 (파티 픽) | `live` | 방 멤버 조합으로 오늘 이야기할 테마 1개 + 싸울 포인트 + 역할을 Gemini 생성. theme-only 환각 방어 + fallback. | `app/api/finz/party/[groupId]/pick`(+`/summary`), `FINZ_PARTY_PICK_SCHEMA`, `finz-party-pick-result` (`FINZ-MVP-04`) | 실명 종목(그라운딩 후), 재추첨 변수 | 토큰 비용, 동시 호출 락 |
| `FINZ-POSITION-01` | 한 줄 입장 + AI 요약 | `live` | 각 멤버가 stance(매력 있음/관망/…)+코멘트를 남기면 AI 가 1회 요약. | `app/api/finz/party/[groupId]/{position,pick/summary}`, `finz-position-input`, `finz-party-summary` (`FINZ-MVP-05`) | N인 방 요약 일반화 | "둘 다 입장" 게이트의 N인 의미 |
| `FINZ-RAID-01` | 투자 레이드 (보스/역할 미션) | `planned` | 우정주를 보스로 두고 캐릭터별 역할 미션으로 대화를 게임화. | 콘텐츠 훅만 존재(피드 `raid_started` 타입), 전용 UI 미구현 | 대화방 안 레이드 세션 | 게임 톤 데모로 검증 후 깊이 결정 |

### AI 봇

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-AI-01` | `@finz` 멘션 답변 + 의도 분류 라우팅 | `live` | `@finz`(별칭 `@핀즈`/`@AI`) 멘션을 LLM 이 **의도로 분류**해 자연어로 기능 실행 — `pick`(우정주)·`summary`(요약)·`position`(입장)·`chart`(차트)·`briefing`(시황 구독)·`qa`(그라운딩 답변, 기본). qa 는 오늘 주가·뉴스까지 Google Search 그라운딩(출처·면책). 멘션 토큰은 강조 칩(`.fz-mention`). | `app/api/finz/party/[groupId]/{intent,ask}`, `lib/common/services/finz-chat.ts`(`splitByMention`), `lib/common/llm.ts`(grounded) | 의도 추가(알림·차트 비교), 답변 품질 eval | constrained enum 흔들림, qa 폴백 정확도, 그라운딩 비용·락, 인젝션 가드 |
| `FINZ-AI-02` | AI 선제 개입 | `live` | 멤버 대화가 쌓이고 AI 가 한동안 말 안 했을 때 맥락 읽고 1회 끼어들어 건전한 투자 대화 유도. | `app/api/finz/party/[groupId]/proactive`, `finz-chat.ts`(`shouldFinzProactivelySpeak`), 쿨다운 락 | 트리거 정교화(과열·근거없음 감지) | 빈도/스팸 톤, 비용(쿨다운 90s) |
| `FINZ-AI-03` | `@finz` 종목 차트 (TradingView) | `live` | "@finz 테슬라 차트 보여줘" → 대화방에 실시간 주가 차트. 의도 분류가 `chart` 인식 + 티커 추출 → `kind:"chart"` 메시지(심볼만 저장, append-only) → TradingView 미니 위젯 임베드(라이브, 베이크 이미지 아님). 데이터는 LLM 아닌 TradingView(환각 방어). | `app/api/finz/party/[groupId]/{intent,chart}`, `finz-chart-bubble`, `finz-chat.ts`(`normalizeChartSymbol`) | 차트 비교·기간 옵션, 캐싱 | 심볼 sanitization(XSS/위젯 안전), 못 잡으면 qa 폴백, 위젯 로드 실패 안내 |

### 정기 브리핑

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-BRIEFING-01` | 정기 브리핑 (매일 아침 시황) | `live` | "@finz 매일 아침 시황 보내줘" 로 방을 구독하면 매일 09:00 KST 그날의 경제 시황(300자+출처)이 finz 메시지로 온다. "@finz 시황 그만 보내" 로 해지. 트리거는 GitHub Actions cron(Vercel Hobby cron 제약 회피, 무료). | `app/api/finz/cron/briefing`, `app/api/finz/party/[groupId]/briefing/subscribe`, `lib/server/finz-briefing-store.ts`(`sw:finz:briefing:<id>:rooms` SET), `.github/workflows/daily-briefing.yml`(`0 0 * * *` UTC) | 시간대·종목별 구독, 사용자별 다이제스트 | **`CRON_SECRET` 수동 설정 필요**(Vercel+GitHub 양쪽 동일 값, 없으면 시황만 안 옴·앱은 정상). Bearer 인증·날짜 멱등 락·구독자 0 LLM 스킵·소멸 방 self-heal |

### 운영/dogfooding

| Feature ID | 기능 | 상태 | 사용자 가치 | 코드 위치 | 신규 후보 | 유지보수 후보 |
|---|---|---:|---|---|---|---|
| `FINZ-OPS-01` | dogfooding 피드백 루프 | `planned` | 친구들이 실제로 친구 추가·대화·우정주·재방문하는지 기록·분석. | travel feedback 시스템 재사용 검토 | travel `TRAVEL-FEEDBACK-01` 패턴 이식 | 성공 기준(`2026-06-13` plan §8) (`FINZ-MVP-06`) |
| `FINZ-OPS-02` | 대화 진입 성능 (SSR 시드·서울 리전) | `live` | 첫 대화 진입을 빠르게 — 계정·방 목록을 SSR 로 시드(왕복 절감), Vercel 함수 리전을 서울(`icn1`)로 정렬해 사용자-함수 왕복 단축. | `app/finz/layout.tsx`(SSR 시드), `lib/server/finz-account.ts`(`resolveAccount` React `cache()`), `vercel.json`(`regions:["icn1"]`) | edge·캐시 추가 최적화 | 계정 SSR 로 finz 셸 동적 렌더(의도된 트레이드오프), DB(Upstash 도쿄/Neon 싱가포르)와 함수 리전 거리 |

## Experiment-3 후보 목록

| Feature ID | 기능 | 상태 | 설명 | 다음 질문 |
|---|---|---:|---|---|
| `EXPERIMENT-3-CORE-01` | 세 번째 서비스 정의 | `placeholder` | FINZ가 별도 서비스로 올라왔으므로 placeholder 의미가 약해짐. | 유지할지, 숨길지, 제거할지? |
| `EXPERIMENT-3-CORE-02` | 실험 종료/삭제 판단 | `placeholder` | 자리만 있는 서비스가 혼란을 만들 수 있음. | FINZ가 세 번째 서비스라면 `/experiment-3`를 제거할지? |

## 팀 운영용 추천 흐름

1. 회의 전에 이 문서에서 각자 관심 있는 Feature ID 1~3개를 고른다.
2. 회의에서는 각 Feature ID 마다 `유지`, `개선`, `보류`, `삭제` 중 하나로 판단한다.
3. 개발 작업은 Feature ID 하나를 기준으로 작은 PR 을 만든다.
4. 비개발자 dogfooding 은 `입력값`, `기대한 결과`, `실제 결과`, `관련 Feature ID` 로 기록한다.
5. 기능이 shipped 되면 이 문서의 상태와 후보 목록을 갱신한다.
