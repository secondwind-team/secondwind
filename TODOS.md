# TODOS

secondwind 의 열린 작업 · 리스크 · 후속 아이템.

- 우선순위: **P0** 블로커 (다음 진행 전 필수) → **P1** 다음 이터레이션 → **P2** 후속 개선 → **P3** 장기 · 있으면 좋음
- 완료 항목은 하단 `## Completed` 로 이동하며 `**Completed:** vX.Y.Z.W (YYYY-MM-DD)` 표기
- 역사적 배경은 `docs/decisions/0001-v0-stack-and-accepted-risks.md` 와 `CHANGELOG.md` 참고

---

## 다음 세션이 꼭 알아야 하는 현재 상태 (context)

코드·git 에서 복구 안 되는 운영 현실. 변경되면 이 섹션도 업데이트할 것.

- **프로덕션 URL:** `https://secondwind-mu.vercel.app`. Vercel 의 main push → production, feature 브랜치 push → preview 자동 배포.
- **Vercel 환경변수 (Production + Preview + Development):** `GEMINI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NEXT_PUBLIC_KAKAO_JS_KEY`. Vercel Dashboard → Settings → Environment Variables 에서 관리. `.env.local` 과 값 동기화 필요.
- **`NEXT_PUBLIC_KAKAO_JS_KEY` 는 SecondWind 카카오 앱이 아니라 akushig 의 기존 다른 앱에서 빌려옴.** 그 앱이 Kakao 정책 강화 전에 만들어져서 "카카오맵" 서비스가 grandfather ON 상태. 그 앱의 JS SDK 도메인 목록에 이 프로젝트 URL 을 등록하는 방식으로 우회 중. **위험:** 해당 앱이 삭제·변경되면 지도가 즉시 깨짐.
- **Kakao 의 "앱 대표 도메인" 필드는 JS SDK whitelist 가 아니다** (삽질 결과). JS SDK 도메인 등록은 "앱 설정 → 플랫폼 키" 에서 JS 키 카드 → "JS SDK 도메인" 섹션.
- **SecondWind 앱 자체는 개인 일반 앱** 이라 "카카오맵" 제품 활성화에 비즈 앱 전환 필수 정책에 걸림. Local API 도 동일한 이유로 사용 못 해서 **지역 검색은 Naver Local Search** 로 대체 중.
- **OSRM public demo (`router.project-osrm.org`)** 는 프로덕션 보장 없는 공개 서버. v0 수준엔 OK 지만 heavy usage 시 rate limit. 대체 옵션: Kakao Mobility (비즈 전환 필요), Mapbox (무료 5만/월), 자체 호스팅.
- **Dogfooding gate (ADR 0001 CRITICAL):** 2026-05-06 까지 akushi 의 실제 여행 날짜 확보. 실패 시 travel-first 포기 or primary user 교체.

---

## Deployment · 인프라

### 커스텀 도메인 붙이기
**Priority:** P1
**Why:** Vercel preview URL 은 feature 브랜치마다 달라서 매번 Kakao JS SDK 도메인 목록에 추가해야 함. 커스텀 도메인 하나 구매해 Vercel alias + Kakao 에 그 도메인만 고정 등록하면 해결.
**Hint:** `$10~20/년` 수준. Vercel 대시보드 → Project → Settings → Domains.

### Kakao 의존성 장기 해결
**Priority:** P1
**Why:** 현재 JS 키는 akushig 의 기존 Kakao 앱 권한에 의존. 그 앱이 바뀌면 지도 깨짐.
**Options:**
- (a) SecondWind 앱을 개인 비즈 앱으로 전환해 자체 권한 확보. 실명 인증 필요. 1영업일 심사.
- (b) Kakao 포기하고 Leaflet + OpenStreetMap 으로 피봇. 한국 지도 디테일 낮지만 외부 의존 없음.
- (c) Mapbox JS SDK (무료 5만 로드/월) 로 이전.

### CI: Kakao 도메인 프로브 체크
**Priority:** P2
**Why:** 지금은 Kakao 도메인 whitelist 누락해도 PR 체크에서 못 잡음. 브라우저 열어서 "지도 로드 실패" 보고 알게 됨.
**Design:** `.github/workflows/kakao-probe.yml` 추가 — `deployment_status` 이벤트에서 `curl -H "Referer: $PREVIEW_URL" https://dapi.kakao.com/v2/maps/sdk.js?appkey=$KEY` 검사. 401/403 이면 PR 체크 실패.
**Key storage:** GitHub repo Secrets 에 `NEXT_PUBLIC_KAKAO_JS_KEY` 추가.

---

## Travel 서비스

### 도로 경로 라우팅 프로덕션 급으로 이전
**Priority:** P2
**Why:** OSRM public demo 는 ToS 상 heavy use 금지. Rate limit 맞으면 지도 경로가 직선으로 fallback 돼 UX 저하.
**Options:** 자체 OSRM 인스턴스, Kakao Mobility (비즈 전환 필요), Mapbox Directions.

### Chat 기반 부분 수정
**Priority:** P2
**Why:** 설계 문서 (`akushi-main-design-20260422-102616.md`) 의 핵심 UX — "박물관 빼줘" 같은 자연어 수정. 현재는 폼 재제출만 가능.
**Blockers:** diff preview · 1-step undo · destructive overwrite 방지. JSON Patch 스키마 고려.

### 해외 여행 지원
**Priority:** P2
**Why:** UI 에 "국내 여행 전용" 배너 띄워둔 상태. Naver Local Search 는 국내 POI 만 → 해외는 enrich 가 안 되거나 다른 provider 필요 (Google Places, OSM Nominatim 등).

### Hallucination 방어 (grounding)
**Priority:** P1
**Why:** ADR 0001 Risk #3 CRITICAL. LLM 이 "흑돈가 성산점" 처럼 존재 안 하는 상호명 제안 → 사용자 신뢰 상실.
**Design 옵션 (earlier 논의):**
- 2-phase LLM: candidates 후보 뽑고 Naver 검증 후 LLM 이 pick.
- Pre-fetch seed POI pool 로 선택지 제한.

### 메뉴 · 가격 · 영업시간 등 세부 정보 검증
**Priority:** P2
**Why:** 현재 추천 메뉴·항목별 비용·영업시간은 Gemini 추정만. UI 엔 점선 밑줄 + "정보 출처" 패널로 "AI 추정" 을 명시해뒀지만 (PR #9), 가능하면 실측으로 덮어쓰고 싶은 영역.
**제약 — Naver 지역검색 API 는 여기 정보 제공 안 함:**
Naver Open API 공식 지역검색은 스키마상 `title / category / phone / address / coordinates / link` 만 반환. 메뉴 · 가격 · 영업시간 · 리뷰는 Naver Place 웹에만 보이고 API 미노출.
**대안 경로 (검토만, 아직 선택 안 함):**
- (A) Naver **블로그 검색 API** + LLM 추출 — 상호명으로 블로그 top N 가져와 본문에서 메뉴·가격 추출. 공식 · 합법. 단점: 장소당 호출 2배 (blog search + LLM 추출) → 쿼터 압박.
- (B) Gemini **Google Search grounding** (`tools: [{ google_search: {} }]`) — 기존 단일 호출에 내장 검색. 코드 변경 최소, 응답 시간↑.
- (C) Google **Places Details API** — 유료. `price_level` / `opening_hours` 는 얻지만 메뉴 텍스트는 거의 미제공 → 한계.
- (D) Kakao Place API — 메뉴·영업시간 양호, **비즈 앱 전환 필수** (현재 개인 앱이라 블록 — Kakao 의존성 TODO 와 연결).
- (E) 서드파티 스크래퍼 (Apify 등) — Naver ToS 위반 리스크, 비추.
**Trigger:** 사용자 신뢰 이슈로 불거지거나, hallucination 방어 (P1) 와 통합 설계 시 같이 결정.

### 프롬프트 출력 구조 eval (골든셋)
**Priority:** P2
**Why:** PR #13 에서 `SYSTEM_PROMPT` 재서술 한 줄이 transit 필드 누락 회귀로 드러남 (v0.1.1.0 → v0.1.3.0 회귀). 시각적으로 드러나는 건 운 좋게 육안으로 catch 했지만, 조용한 회귀 (예: caveats 누락, `place_query` 비율 하락, budget 필드 누락) 는 eval 없이 놓치기 쉬움. Gemini 2.5 Flash Lite 가 프롬프트 구조에 특히 민감하다는 증거.
**Design:**
- `scripts/eval-travel.ts` — 5~10개 대표 입력 스냅샷 (당일·1박·2박·3박 × 혼자·커플·아이 동반·부모님 × 자차·대중교통·기차)
- 각 입력당 `/api/gemini` 1회 호출 후 metric 계산:
  - `transit_coverage`: day 당 첫 item 제외 모든 item 에 `transit` 존재 비율 (목표 100%)
  - `rule3_violations`: 제목에 "도착/출발/체크인/조식/휴식/드라이브" 포함 item 수 (목표 0)
  - `place_query_ratio`: `place_query` 있는 item / 전체 item (목표 ≥ 80%)
  - `meal_completeness`: 각 day 에 점심·저녁 장소 존재 여부 (목표 100%)
- CI 미포함 (API cost) — 프롬프트 수정 시 로컬 수동 실행
- 결과를 `docs/eval/snapshots/` 에 커밋해 diff 로 회귀 추적
**Trigger:** 같은 유형의 회귀가 한 번 더 발생 → P1 승격. 또는 Gemini 모델 업데이트 후 검증용.
**관련:** PR #13, `docs/decisions/0001-v0-stack-and-accepted-risks.md` (v0 에서 의식적으로 skip 한 exit criteria 중 하나 재검토).

### LLM quota 모니터링 + 사용자 전달
**Priority:** P3
**Why:** 현재 429 시 "1~2분 뒤 다시 시도" 문구만. 언제 풀리는지 · 일일 quota 인지 분당 quota 인지 구분 없음. Google AI Studio Dashboard 링크 or 간단한 사용량 estimation 노출 고려.
**Done so far:** PR #69 in-request Naver 호출 뱃지, PR #71 Naver 일일 누적 quota 디버그 패널 표시. Gemini 도 quota-store 가 RPM/RPD/TPM 추적 + 디버그 패널에 표시 중. **남은 부분:** 사용자(비개발자) 친화 메시지 — 디버그 패널 외 일반 UI 에서도 429 시 "약 X분 뒤 자동 복구" 같은 명확한 안내. Trigger: 실 사용 중 429 다발 시.

### 결정 funnel 분석 — 데이터 수집 후 첫 분석
**Priority:** P2
**Why:** PR #75 로 Vercel Analytics + 핵심 이벤트(plan_generated/regenerated/confirmed/share_created/ics_downloaded/plan_swapped) 도입. 일주일 ~ 한 달 데이터 쌓이면 재생성률·확정률·공유율 분석. "이 정도면 됨" 작동 여부 첫 데이터 기반 검증.

### 서비스 워커 + 오프라인 캐시
**Priority:** P3
**Why:** PR #74 로 PWA manifest + 아이콘은 도입 (홈 화면 설치 가능). 오프라인 캐시 / SW 는 별개. workbox 같은 라이브러리 도입해 share 받은 plan 을 비행기 모드에서도 열 수 있게.

### URL 공유 (LZ-string 압축)
**Priority:** P3
**Why:** 설계 문서의 primary 공유 방식. 플랜 state 를 query param 으로 압축해 카톡 공유. (현재는 KV 기반 + 동적 OG 미리보기는 PR #61 로 도입.)

### Plan 비교 모드 — day/item 단위 diff
**Priority:** P3
**Why:** PR #73 로 두 plan 사이 toggle (직전 결과 전환) 은 도입. 다음 단계는 두 plan 의 변경된 day/item 을 highlight 로 표시 (added/removed/changed). state 는 이미 있어서 비교 알고리즘만.

---

## 팀 · 제품

### Dogfooding gate (CRITICAL)
**Priority:** P0
**Why:** ADR 0001. 2026-05-06 까지 akushi 본인 실제 여행 날짜 확보 못 하면 primary user 가 허구로 남음.
**Plan A:** travel-first 포기, `/office-hours` 재실행해서 다른 아이디어로 피봇.
**Plan B:** primary user 를 지인 1명 (30일 내 여행 예정자) 으로 교체.

### 팀원 합의 (태훈 · 덕우)
**Priority:** P1
**Why:** ADR 0001 Risk #2 CRITICAL. 모노 플랫폼 · diary/experiment-3 placeholder 합의가 암묵적. 두 사람이 별도 repo 선호로 돌아서면 아키텍처 재논의 필요.

---

## Completed

- **travel v0 스캐폴딩 (플랫폼 + 여행 서비스)** — PR #1, v0.1.0.0 (2026-04-22)
- **지도 경로 시각화 (Kakao Maps JS SDK)** — PR #2 (2026-04-22)
- **지도-카드 번호 매칭 + OSRM 실제 도로 경로** — PR #3 (2026-04-23)
- **OSRM 거리·시간 덮어쓰기 + 정확도 UI (점선 밑줄 + 정보 출처 패널)** — PR #9 (2026-04-23)
- **travel 결정 패널 v0** — v0.1.8.0 (2026-04-25)
- **Naver 호출 동시성 4건 throttle + 60+ burst 차단** — PR #52, v0.1.12.0 (2026-04-29)
- **decision 부분 채움 응답 정규화 (Flash Lite 회귀 방어)** — PR #53 (2026-04-29)
- **숙소 enrich 실패 시 사용자 알림** — PR #54 (2026-04-29)
- **Kakao SDK 로더 memoize + race 가드** — PR #55 (2026-04-29)
- **클라이언트 응답 isTravelPlan 가드** — PR #56 (2026-04-29)
- **PlacePopup SDK 로드 실패 fallback** — PR #57 (2026-04-29)
- **navigator.share() 네이티브 공유** — PR #58 (2026-04-29)
- **테스트 프레임워크 도입 (vitest + 71 단위 테스트)** — PR #59, #64 (2026-04-29). ADR 0001 sovereignty 표 #4 부분 변경 — Amendments 섹션 참조.
- **CI: typecheck / lint / build / test 게이트** — PR #60 (2026-04-29)
- **공유 링크 OG 미리보기 이미지 + 동적 metadata** — PR #61 (2026-04-29)
- **OSRM 호출 day 단위 sequential** — PR #63 (2026-04-29)
- **iCal `.ics` 캘린더 내보내기** — PR #64 (2026-04-29)
- **인쇄 CSS — 종이 동선표** — PR #65 (2026-04-29)
- **루트 `/` OG 미리보기 이미지 + metadata 보강** — PR #66 (2026-04-29)
- **enrichPlan in-request 캐시 (중복 Naver 호출 dedupe)** — PR #67 (2026-04-29)
- **map-view 마커 클러스터링 + zoom 기반 라벨 토글** — PR #68 (2026-04-29)
- **plan 헤더 Naver 호출 횟수 뱃지** — PR #69 → PR #71 (2026-04-29). #69 는 stack squash 함정으로 main 누락 → #71 에서 변경 재포함.
- **Naver 일일 누적 quota 카운터 (KV) + 디버그 패널 표시** — PR #71 (2026-04-29)
- **이동수단별 OSRM polyline 분기 (도보/자전거/차량/대중교통)** — PR #72 (2026-04-29)
- **plan 비교 모드 — 직전 결과 보존 + 토글** — PR #73 (2026-04-29)
- **PWA manifest + 아이콘 (홈 화면 설치)** — PR #74 (2026-04-29)
- **Vercel Analytics + 결정 funnel 핵심 이벤트** — PR #75 (2026-04-29)
