# Changelog

secondwind 의 주요 변경 사항을 기록합니다. 날짜 포맷은 `YYYY-MM-DD`, 버전은 4자리 `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.8.2] - 2026-04-25

### Fixed
- `/travel` 추천 결과에서 전체 경로 지도와 장소별 카카오맵 열기 버튼이 사라지던 회귀 수정. `responseSchema` 적용 후 Gemini 가 `place_query` 를 전부 생략할 수 있었고, 그 결과 Naver 위치 보강이 좌표를 붙이지 못해 지도 UI 가 숨겨졌음.
- 생성 스키마에서는 `place_query` 를 필수 문자열로 강제하고, 구체 장소가 아닌 항목은 빈 문자열로 정리. 기존 공유 링크 호환을 위해 런타임 type guard 는 optional 허용을 유지.
- 생성 후 정리 단계에서 각 날짜 첫 item 의 잘못된 이동 정보와 공항·렌터카·숙소 체크인/아웃·조식의 지도 검색어를 제거해 지도 품질을 보호.

## [0.1.8.1] - 2026-04-25

### Changed
- `/travel` 의 Gemini 호출에 `responseSchema` (constrained decoding) 적용. 이전엔 system prompt 의 자연어 부탁만으로 JSON 형식을 지키게 했어서 가끔 필드 누락·타입 불일치로 "받은 플랜을 이해하지 못했어요" 에러가 떠짐. schema 강제로 (B) 부류 파싱 실패가 디코더 레벨에서 차단됨. 사용자 자유 입력 (`prompt`) 의 자연어 유연성과 출력의 자연어 슬롯 (`rationale`, `caveats`, `decision.*`) 은 그대로 유지.
- `maxOutputTokens` 6144 → 8192 로 상향. 3박+많은 item+긴 rationale 케이스에서 cap 에 닿아 출력이 잘리던 truncation 의 마진 확보.

## [0.1.8.0] - 2026-04-25

### Added
- `/travel` 결과 상단에 **결정 패널** 추가. 긴 일정 전체를 다시 읽기 전에 `좋은 점` · `확인 필요` · `확정 후 할 일` 을 먼저 보여줘서 사용자가 "이 일정으로 가도 되는지" 판단할 수 있게 함.
- `TravelPlan.decision?: { good_reasons, check_before_confirming, todo_after_confirming }` 필드 추가. Gemini 프롬프트와 런타임 파서가 모두 optional 필드로 인식하므로 기존 공유 링크와 오래된 응답은 fallback 문구로 계속 렌더.
- `이 일정으로 확정` 버튼과 브라우저별 `localStorage` 확정 상태 저장. 확정 후에는 `확정됨` 배지와 `확정 완료` 버튼 상태를 표시하고, `확정 후 할 일` 을 체크리스트로 보여줌.

### Changed
- `.gstack/` 로컬 QA 산출물을 git ignore 대상에 추가.

### Docs
- `docs/plans/2026-04-25-travel-decision-panel-v0.md` 에 결정 패널 v0 목표, UX, 데이터 설계, 비목표, 리스크를 기록.

## [0.1.7.0] - 2026-04-24

### Changed
- **장소 카드 지도 아이콘을 인앱 레이어 팝업으로 전환.** 이전엔 카카오맵 웹/앱을 새 탭/외부 앱으로 열어 흐름이 끊겼음. 지금은 같은 페이지 안의 모달 (모바일 바텀 시트 · 데스크톱 중앙 카드) 에 카카오맵 JS SDK 로 미니맵 + 장소명·카테고리·주소·전화 표시. 기존 "카카오맵에서 열기 (길찾기·거리뷰)" 기능은 팝업 하단의 외부 링크 버튼으로 유지.
- `<a href target="_blank">` → `<button onClick>` 으로 교체. `<summary>` 내부 default toggle 과 충돌하지 않도록 `preventDefault` + `stopPropagation` 처리.
- ESC 키 · 배경 클릭 · X 버튼으로 닫힘. 접근성: `role="dialog"` · `aria-modal="true"` · `aria-label`.

### Added
- 신규 컴포넌트 `app/(site)/travel/_components/place-popup.tsx`.
- 신규 공유 모듈 `lib/common/kakao.ts` — Kakao Maps JS SDK 로더 + 타입. 기존 `map-view.tsx` 의 inline 정의를 추출해 `PlacePopup` 과 공유. MapView 도 같은 lib 사용.

### Note
- 장소 카드에 `item.place` 또는 `item.place_query` 가 없으면 지도 아이콘 자체가 숨겨짐 (보여도 쓸모 없으니까).
- Naver 매칭 실패로 lat/lng 없는 경우 팝업은 지도 대신 fallback 텍스트 "정확한 위치를 확인하지 못했어요 · '검색어' 로 카카오맵에서 확인" 과 외부 링크 버튼만 노출.

## [0.1.6.0] - 2026-04-24

### Added
- **숙소 자동 추출 + 지도 표시.** 사용자 자유 요청에 구체적인 숙소명이 명시돼 있으면 (예: `숙소: 네스트호텔`) LLM 이 `TravelPlan.stay = { name }` 으로 추출. Naver 지역검색으로 lat/lng 매칭해 지도에 다크 컬러 `🏨 숙소` 마커 + legend 에 상호명 표기. 플랜 카드 헤더에도 `🏨 네스트호텔` 한 줄 추가 (enrich 성공 여부와 무관하게 사용자 입력 확인용).
- `TravelPlan.stay?: { name: string; place?: PlaceInfo }` 필드 추가 (optional).

### Changed
- `travel-enrich.ts` 가 `stay.name` 도 Naver 지역검색 대상에 추가.
- 지도 legend 렌더 조건 확장: 이전엔 `plan.days.length > 1` 일 때만. 이제 `plan.stay.place` 있으면 1일 여행이어도 legend 렌더 (숙소 라인 표시).

### Note
- "아직 안 정함"·"미정"·"게스트하우스 아무거나" 처럼 특정되지 않은 경우는 stay 필드 자체 생략 (시스템 프롬프트 명시). 실측으로 확인.

## [0.1.5.0] - 2026-04-24

### Changed
- `/travel` 결과 상단의 한 줄 `summary_line` 을 제거하고, **2~4문장짜리 `rationale` 필드**로 교체. 일정 설계 근거(왜 이 구성인지·사용자 요청 반영 방식) + 달성 못한 요청의 사유(특히 예산 초과 시 "요청 X만원 · 예상 Y만원 (Z만원 초과)" 숫자 명시 + 대안 제시) 를 담음. 이전 `summary_line` ("맞춤형 일정입니다" 류 boilerplate) 이 정보량이 없다는 피드백 반영.
- `TravelPlan.summary_line: string` → `TravelPlan.rationale: string` (schema 변경, 파서·UI·시스템 프롬프트 동기 수정).
- `/api/gemini` 의 `maxTokens` 4096 → 6144 상향. rationale 추가로 응답 토큰 여유 확보 (특히 3박 이상 + 긴 gap 설명 시 truncation 방지).

### UI
- `PlanCard` 헤더 본문 스타일: `text-base font-medium` → `text-sm leading-relaxed` (2~4문장 가독성), `whitespace-pre-wrap` 추가로 LLM 이 문단 구분 시 정상 렌더.

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
