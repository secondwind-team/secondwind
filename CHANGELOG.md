# Changelog

secondwind 의 주요 변경 사항을 기록합니다. 날짜 포맷은 `YYYY-MM-DD`, 버전은 4자리 `MAJOR.MINOR.PATCH.MICRO`.

## [0.1.12.0] - 2026-04-29

긴 reliability + 점검 후 후속 작업 묶음. 사용자 직접 보이는 새 기능과 운영 안정성 개선이 함께.

### Added
- 결과 카드의 공유 섹션에 **iCal `.ics` 받기** 버튼 추가. 시간 있는 일정만 VEVENT 로 변환하여 구글/애플/네이버 캘린더에 한 번에 import (PR #64).
- 공유 링크 생성 후 **`navigator.share()` 네이티브 공유** 버튼이 모바일에서 노출. 카톡·메시지·메일 OS 공유 시트 직접 호출 (PR #58).
- 공유 링크(`/travel/[shareId]`) 의 **OG 미리보기 이미지** 자동 생성. 카톡·트위터에 링크 붙이면 secondwind 브랜드 + 목적지·일수·기간이 큰 카드로 보임. Noto Sans KR 동적 subset (PR #61).
- 루트 `/` 의 **OG 미리보기 이미지** 도 같은 패턴으로 추가. travel/diary/experiment 태그 칩 (PR #66).
- **인쇄 CSS** — 브라우저 인쇄 시 지도·인터랙션·디버그 영역 자동 숨김, 텍스트 위주의 종이 동선표. 외부 링크는 본문에 URL 같이 표시 (PR #65).
- 지도에 **마커 클러스터링 + zoom 기반 라벨 토글**. 줌아웃 시 인접 day 마커가 cluster 로 합쳐져 라벨 겹침 회피 (PR #68).
- 결과 카드 헤더에 **"Naver 호출: N건"** 뱃지. 이번 plan 생성에서 실제 fetch 가 발생한 unique query 수를 표시 — quota 압박 + cache 효과 가시화 (PR #69).
- **단위 테스트 프레임워크 vitest** 도입. 61 케이스 (`travel.ts` sanitize·decision 정규화·budget·input normalization, `travel-share-store.ts` parseSnapshot, `travel-ics.ts` ics 생성) (PR #59, #64, ADR 0001 amendment).
- **CI: typecheck / lint / build / test 게이트** (`.github/workflows/build.yml`) 추가. 모든 PR 의 회귀를 사람·AI 가 명령 잊어도 잡힘 (PR #60).
- 사용자 친화 메시지: travel 응답이 invalid-response 일 때 "응답을 해석하지 못했습니다…" 문구 (PR #51).

### Changed
- **Naver Open API 호출 동시성 4건으로 제한**. 한 plan 생성에서 누적 60+ 호출까지 burst 가능했던 자리 — Naver burst 차단 + 일일 quota(25k) 보호 (PR #52).
- **enrichPlan in-request 캐시** 도입. 같은 query+destHint 가 grounded pool / enrich / candidate pass / repair 사이에서 반복 호출되던 자리를 한 번에 dedupe (PR #67).
- **OSRM 호출을 day 단위 sequential** 로 변경 + day 사이 120ms 간격. public OSRM demo 의 burst rate 정책 우회 → 직선 fallback 빈도 ↓ (PR #63).
- **Flash Lite 의 partial decision 응답 정규화**. `decision` 의 세 배열 중 하나만 누락해도 plan 전체가 invalid-response 로 떨어지던 자리, `parseTravelPlan` 의 검사 직전에 빈 배열 채워 통과 (PR #53).
- **숙소 위치를 못 찾았을 때 사용자에게 알림**. `Stay.place_warning` 필드 추가, decision 패널의 "확정 전에 확인할 것" 에 자동 노출. 못 찾은 숙소는 "숙소 기준점으로 동선 판단" good_reason 에서도 자동 제거 (PR #54).
- **클라이언트 응답에 `isTravelPlan` 가드** 추가 — 서버는 이미 검증하지만 caching/proxy 변형에 대한 defense-in-depth (PR #56).
- **Kakao SDK 로더 memoize + race 가드**. 동시에 세 컴포넌트가 호출 시 첫 onload 직후 두 번째 호출이 영원히 pending 되던 race 제거 (PR #55).
- **PlacePopup SDK 로드 실패에 fallback 메시지** 표시. 빈 회색 박스 대신 "지도를 불러오지 못했습니다" + 카카오맵 외부 링크 안내 (PR #57).

## [0.1.11.0] - 2026-04-26

### Added
- `/travel` 추천 방식에 네 번째 옵션 **지도 후보 기반 (grounded)** 추가. 사용자 요청에서 시드(목적지 카테고리·동행자·음식 키워드)를 추출해 Naver 후보 풀을 먼저 만들고, LLM 은 그 풀의 이름과 정확히 같은 문자열만 `place_query` 로 사용하도록 단일 패스 grounding 적용. 풀 외부 장소는 후처리에서 빈 문자열로 정리되고, 풀 내부 장소는 Naver 재호출 없이 풀에서 좌표·주소·카테고리를 직접 채움.
- `npm run eval:travel` 의 PLANNING_MODELS 에 `grounded` 추가 — 기존 골든셋 3개에서 동일 메트릭으로 측정 가능.
- 새 모듈 `lib/common/services/travel-grounded.ts` — 시드 추출, 풀 수집, 풀 기반 plan 보정.

### Changed
- 기존 `classic` / `balanced` / `verified` 의 동작은 유지. 사용자가 명시적으로 `grounded` 를 선택할 때만 새 흐름으로 분기.
- `grounded` 모델은 `recommended_menu` / `cost_krw` 가 모두 AI 추정임을 system prompt 로 명시해 보수적 출력을 유도.

## [0.1.10.2] - 2026-04-26

### Added
- `/travel` 선택 옵션에 Kakao Places 기반 숙소 선택 모달 추가. 선택한 숙소는 구조화 입력으로 전달되어, 별도 요청이 없으면 숙소 기준 동선을 만들도록 프롬프트에 반영.
- 모든 site 페이지 우하단에 피드백·버그리포트 플로팅 버튼 추가. 입력 폼이나 결과 카드 안에 고정 노출하지 않고 필요할 때만 열 수 있음.

### Changed
- `/travel` 선택 옵션을 요청사항보다 위로 이동.
- 예산 포함 범위를 `숙박` · `렌트` · `교통` · `입장` · `식비` · `쇼핑` 복수 선택 아이콘으로 변경. 기본값은 쇼핑을 제외한 모든 항목.
- `/travel` 디버그 패널을 전면 노출하지 않고 좌하단 작은 아이콘을 눌렀을 때만 열리도록 변경.

## [0.1.10.1] - 2026-04-26

### Changed
- `/travel` 첫 화면의 hero 높이를 줄여 입력 폼이 더 빨리 보이도록 조정.
- `/travel` 입력 폼에서 요청사항을 예산·추천 방식보다 먼저 배치하고, 예산·추천 방식은 선택 옵션으로 접어 기본 입력 흐름을 짧게 만듦.
- `/travel` 결과 화면에서 공유 링크와 피드백 폼을 일정·지도·비용·출처 확인 뒤로 이동. 피드백은 접힌 상태에서 필요할 때만 열도록 조정.

## [0.1.10.0] - 2026-04-26

### Added
- `/travel` 폼에 예산 입력과 포함 범위 라디오 추가. 자유 요청 텍스트가 아닌 구조화된 숫자로 받아 결정적 검증이 가능해짐.
- 결과 카드에 예산 초과 배너 추가. 요청 예산을 5% 이상 초과하면 카드 최상단에 "요청 ₩X · 예상 ₩Y (₩Z 초과)" 와 예산 기준(활동·식사 / + 이동 / 전부) 을 노란색으로 표시.

### Changed
- 예산 초과 시 "이 일정으로 가도 되는 이유 → 좋은 점" 의 LLM 출력 중 "예산 내", "예산 맞춰" 같은 자축 표현은 자동으로 제거.
- 예산 초과 시 "확인 필요" 컬럼의 첫 줄로 초과 사실을 강제 주입해 모순된 안내를 차단.
- 예산 초과 시 카드 헤더 카피를 "이 정도면 됩니다" 에서 "확인이 필요합니다" 로 전환.
- SYSTEM_PROMPT 의 예산 규칙을 강화. rationale 뿐 아니라 `decision.good_reasons` 의 자축 표현을 금지하고 `check_before_confirming` 의 첫 항목으로 초과 통지를 강제.

## [0.1.9.7] - 2026-04-26

### Changed
- 여행 계획 생성 시 LLM 쿼터(rpd/rpm/tpm) 차단 안내를 dim 별로 분기. RPD 소진은 "한국시간 16~17시 이후 자동 복구", RPM/TPM 일시 초과는 retryMs 기반 재시도 안내, 모든 모델이 차단된 경우 명확한 메시지로 안내.
- 차단된 모델은 라우트 진입 시 미리 건너뛰어, 매 요청마다 발생하던 429 round-trip 을 제거. fallback 모델로 즉시 전환되어 latency 가 줄어든다.
- 429 등 실패한 호출 시도도 Upstash 에 0 토큰으로 기록. 디버그 패널의 누적 RPD 가 Google 쪽 카운터와 더 가깝게 일치한다.

## [0.1.9.6] - 2026-04-26

### Added
- `npm run eval:travel` 에 `--retry-429` / `--retry-429-ms` 옵션 추가. Gemini quota 429 가 섞일 때 일정 시간 기다렸다가 같은 run 을 재시도하고, snapshot 에 attempt 이력을 남김.

## [0.1.9.5] - 2026-04-26

### Changed
- 생성 후 정리 단계에서 `애월 맛집`, `근처 식당`, `시내 카페`, `지역 맛집`, `제주 돈까스` 처럼 단일 POI 로 찾기 어려운 일반 검색어를 `place_query` 에서 제거.
- eval 에서 드러난 `장소 정확도 우선` 모델의 generic query 문제를 줄여, 지도에 잘못된 후보나 확인 불가 warning 이 쌓이는 것을 완화.

## [0.1.9.4] - 2026-04-25

### Changed
- Naver 장소 매칭에서 해변·공원·박물관 같은 명소 query 가 편의점·음식점 등 부속 상호로 붙는 false positive 를 reject 하도록 업종 필터를 추가. 단, 시장 query 는 쇼핑/유통 계열 업종을 정상 후보로 허용.
- 생성 후 정리 단계에서 `체크인` · `체크아웃` · `낮잠` · `숙소 복귀/휴식` 항목의 `place_query` 를 더 확실히 제거해 숙소 부속 카페/식당으로 잘못 매칭되는 경우를 줄임.
- 지도 검색 결과가 없는 `place_query` 도 `place_warning` 으로 표시해 결과 상단의 `확인 필요` 숫자가 실제 미확인 장소를 반영하도록 수정.
- `npm run eval:travel` snapshot 에 각 item 의 `placeQuery` · 매칭 장소명 · 업종 · 주소 · warning 을 담는 `placeAudit` 를 추가해 다음 튜닝에서 실패 원인을 바로 볼 수 있게 함.
- `npm run eval:travel` 은 기본적으로 일부 모델 호출이 429 등으로 실패해도 snapshot 과 에러 테이블을 남기고 종료하도록 조정. 실패를 CI 처럼 엄격히 다루고 싶을 때는 `--strict` 사용.

## [0.1.9.3] - 2026-04-25

### Added
- `npm run eval:travel` 추가. 실행 중인 로컬 앱의 `/api/gemini` 를 호출해 `빠른 추천` · `균형형` · `장소 정확도 우선` 을 같은 골든셋 입력으로 비교하고, 장소 확인율·warning·outlier·repair 수·토큰·소요 시간을 요약.
- eval snapshot 을 `.gstack/evals/travel/*.json` 에 저장해 반복 실험 결과를 로컬에서 비교할 수 있게 함.

## [0.1.9.2] - 2026-04-25

### Changed
- `/travel` 의 `장소 정확도 우선` 추천에 후보 기반 2-pass 검수 추가. 초안의 장소명을 Naver 지역검색 후보로 변환한 뒤, 보조 LLM 이 후보 목록 안에서만 최종 `place_query` 를 고르게 함.
- 후보가 활동과 맞지 않거나 확신이 없으면 `place_query` 를 비워 잘못된 지도 핀을 피함. 후보 목록 밖의 장소명 창작은 적용하지 않음.
- `장소 정확도 우선` 설명 문구를 후보 검수 기반 동작에 맞춰 조정.

## [0.1.9.1] - 2026-04-25

### Changed
- `/travel` 의 기본 추천 방식인 `균형형` 에 장소 repair pass 추가. 최초 지도 검증에서 실패한 `place_query` 를 최대 6개까지 낮은 temperature 의 보조 LLM 패스로 더 검색 가능한 단일 POI 명으로 고친 뒤 다시 Naver 위치 보강을 실행.
- repair pass 의 추가 토큰 사용량과 rate-limit hit 를 API 응답 통계에 합산하고, 실제 좌표가 붙은 repair 수를 `placeStats.repairedPlaces` 로 표시.
- 좋은 대체 장소명을 찾지 못하면 잘못된 지도 핀을 세우는 대신 `place_query` 를 비워 장소 확인 필요 상태로 남김.

## [0.1.9.0] - 2026-04-25

### Added
- `/travel` 폼에 추천 방식 선택 추가: `빠른 추천`, `균형형`, `장소 정확도 우선`. 기본값은 속도와 장소 검증 사이의 균형을 잡는 `균형형`.
- 여행 계획 생성 흐름을 `planningModel` 기반 planner 전략으로 분리. 현재는 모델별 temperature 와 장소명 규칙을 달리 적용하고, 이후 repair pass 와 후보 기반 2-pass 검증을 붙일 수 있는 구조로 열어둠.
- API 응답에 `planningModel` 과 `placeStats` 를 추가. 결과 상단에서 사용한 추천 방식과 장소 확인 비율을 작게 표시.
- `docs/plans/2026-04-25-travel-planning-models.md` 에 추천 모델 설계, 측정 지표, 다음 단계를 기록.

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
