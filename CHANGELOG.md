# Changelog

secondwind 의 주요 변경 사항을 기록합니다. 날짜 포맷은 `YYYY-MM-DD`, 버전은 4자리 `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.4.0] - 2026-04-24

### Changed
- `/travel` 장소 카드 summary 에 Naver 로 매칭된 상호명을 활동 뒤에 이어 표시 (예: `점심 식사 · 초당순두부`). 이전에는 "점심 식사" / "저녁 식사" 같은 일반 텍스트만 보여서 지도 아이콘을 눌러야 식당을 알 수 있었음. `item.place.name` 이 있고 `item.text` 에 이미 포함돼 있지 않은 경우에만 노출해 중복 방지.

## [0.1.3.0] - 2026-04-24

### Fixed
- `/travel` 결과의 장소 카드 사이에 이동경로 정보 (transit row) 가 표시되지 않던 회귀 수정. v0.1.1.0 의 인원 필드 제거 이후 Gemini 가 transit 필드를 중간 item 에서 반복적으로 누락하고, 대신 금지된 "도착/출발/귀가" phantom item 에만 붙이는 현상이 관찰됨.
- 시스템 프롬프트의 transit 규칙을 완곡어 "생략 가능" → "첫 item 만 생략, 그 외 필수 (값 누락 금지)" 로 강화.
- rule #3 (도착/출발 등 생략 대상 활동) 에 "transit 필드도 붙이지 말 것 · 이동은 별도 item 이 아니라 다음 실제 장소의 transit 필드로" 문구 추가.
- 배경: `/travel` 실측 — 수정 전 14개 item 중 transit 2개 (도착·귀가 phantom 에만), 수정 후 10개 item 중 9개 transit 정상 부착 확인.

## [0.1.2.0] - 2026-04-23

### Added
- `/travel` 폼의 요청사항 textarea 상단에 `가이드 양식` · `예시 보기` 아이콘 버튼 추가 (`lucide-react`).
- 가이드 양식: 여행예산 · 숙소 · 구성원 · 주 이동수단 · 여행스타일 · 그 외 추가정보 라벨만 있는 빈 skeleton 을 textarea 에 삽입.
- 예시 보기: 5개 완성된 샘플 프롬프트를 인라인 아코디언으로 표시 — 아이 동반/부모님 동반/커플/혼자/친구 여럿 각 상황. 카드 클릭 시 textarea 에 삽입.
- 삽입 시 기존 입력이 있으면 confirm 후 replace (기존 입력 보호).

### Changed
- 요청사항 textarea placeholder 를 두 버튼으로 유도하는 문구로 교체.

### Dependencies
- `lucide-react` ^1.8.0 추가 (아이콘 2개 사용: `ListPlus`, `Lightbulb`).

## [0.1.1.0] - 2026-04-23

### Changed
- `/travel` 폼의 인원 입력 카운터 (성인/청소년/어린이/영유아) 를 제거. 인원·동행자 정보는 자유 요청사항 텍스트로 통합해 입력받음. 배경과 근거: `docs/decisions/0002-remove-party-counter.md`.
- 자유 요청사항 입력 한도 `USER_PROMPT_MAX` 를 300 → 1000자 로 상향. 인원·숙소·이동수단 등 맥락을 자유 텍스트로 충분히 담을 수 있도록.
- 시스템 프롬프트 보강 — 구조화된 "인원:" 줄 대신 자유 요청 텍스트에서 인원·동행자 정보를 해석하도록 명시.
- 자유 요청사항 textarea 의 placeholder 를 인원 맥락이 포함된 예시로 교체 (`성인 2명과 6세 아이, 렌트카로, ...`).

### Removed
- `TravelInput.party`, `TravelParty` 타입, `PARTY_KEYS`, `PARTY_LABELS`, `formatParty`, `partyTotal` export 제거.
- 백엔드 `normalizeTravelInput` 의 party 검증 로직 (`total ≥ 1`, `adults≥1 if kids>0`) 제거.
- 프론트 `TravelForm` 의 `PartyRow` 컴포넌트·party state·`partyDetailed` 토글 제거.

## [0.1.0.0] - 2026-04-23

### Added
- Next.js 15 (App Router) + TypeScript + Tailwind CSS 기반 플랫폼 스캐폴딩.
- 랜딩 페이지 (`/`) 에 3개 서비스 카드 — `travel` (지헌), `diary` (태훈 placeholder), `experiment-3` (덕우 placeholder).
- 여행 계획 서비스 (`/travel`) v0:
  - 폼 입력 — 목적지·기간·인원(성인/청소년/어린이/영유아 세분화 토글)·자유 요청사항.
  - 공용 API 프록시 `/api/gemini` 로 Gemini 2.5 Flash Lite 호출해 JSON 플랜 생성.
  - 각 일자 타임라인 카드 — 시간·텍스트·지도 링크에 펼치면 주소·전화·카테고리·비용·추천 메뉴 표시.
  - 장소 간 이동 정보 row (이동수단·시간·비용) 삽입.
  - Naver Local Search 로 실제 장소 enrich (bigram Jaccard 매칭·재시도·destination prefix).
  - 예상 총 경비 breakdown (활동·이동·기타) + `<details>` 안에 세부 내역 표시.
- 공통 모듈 — `components/common/service-card.tsx`, `lib/common/{env,llm}.ts`, `lib/common/services/{travel,travel-enrich}.ts`.
- 팀 규칙 문서 — `docs/decisions/0001-v0-stack-and-accepted-risks.md` 에 거절한 리뷰 챌린지 4건·수용한 리스크 5건 기록.
- 환경변수 템플릿 `.env.local.example` (`GEMINI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`).
- `.eslintrc.json` 에 cross-service import 차단 규칙.

### Changed
- `CLAUDE.md` / `AGENTS.md` / `app/README.md` 를 v0 스캐폴딩 진입 상태로 최신화.
- `.gitignore` 에 `.next/`, `out/`, `*.tsbuildinfo` 추가.
