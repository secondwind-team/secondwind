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

### CI: typecheck / lint / build 게이트 추가
**Priority:** P2
**Why:** 지금 `guard.yml` 은 커밋 author 만 검사. 일반 코드 회귀를 PR 단계에서 걸러내는 체크가 없음.
**Design:** `.github/workflows/build.yml` — `npm ci` + `npx tsc --noEmit` + `npm run lint` + `npm run build`.

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

### LLM quota 모니터링 + 사용자 전달
**Priority:** P2
**Why:** 현재 429 시 "1~2분 뒤 다시 시도" 문구만. 언제 풀리는지 · 일일 quota 인지 분당 quota 인지 구분 없음. Google AI Studio Dashboard 링크 or 간단한 사용량 estimation 노출 고려.

### 결정 종료율 KPI 측정
**Priority:** P3
**Why:** ADR 0001 의 "NOT in scope" 목록. "이 정도면 됨" 이 실제로 작동하는지 측정 없이는 product-market fit 체크 불가. 재생성률 · 공유 클릭 · edit 횟수 등 trace.
**Hint:** Vercel Analytics 또는 PostHog 무료 티어.

### PWA manifest + 서비스 워커
**Priority:** P3
**Why:** 설계 문서 distribution 계획의 일부. 홈 화면 설치, 오프라인 저장된 일정 열람. Phase 3 네이티브 래핑의 전제.

### URL 공유 (LZ-string 압축)
**Priority:** P3
**Why:** 설계 문서의 primary 공유 방식. 플랜 state 를 query param 으로 압축해 카톡 공유. `@vercel/og` 로 preview 이미지까지 붙이면 바이럴 루프.

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

### 테스트 프레임워크 도입
**Priority:** P2
**Why:** 기능이 쌓일수록 회귀 리스크 증가. 지금은 `.gstack/no-test-bootstrap` 마커로 의식적 skip 상태 (ADR 0001 sovereignty).
**Trigger:** 첫 회귀 사고 후 or 팀원 합류 시.

---

## Completed

- **travel v0 스캐폴딩 (플랫폼 + 여행 서비스)** — PR #1, v0.1.0.0 (2026-04-22)
- **지도 경로 시각화 (Kakao Maps JS SDK)** — PR #2 (2026-04-22)
- **지도-카드 번호 매칭 + OSRM 실제 도로 경로** — PR #3 (2026-04-23)
