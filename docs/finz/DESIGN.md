# FINZ 디자인 시스템 — 따뜻한 채팅 (Warm Chat)

> FINZ 전용 디자인 시스템. **secondwind / travel 과 완전히 독립**이다 — 토큰 네임스페이스(`--fz-*`), 전용 폰트, 전용 레이아웃 셸을 쓰고 공용 `--ink/--muted/--line/--accent` 나 emerald 팔레트를 절대 참조하지 않는다. UI/디자인 결정 전 이 문서를 먼저 읽는다.
>
> 2026-06-14 `/design-consultation` 으로 생성. 미감 방향은 사용자가 "따뜻한 채팅"으로 확정.

## 제품 맥락

- **무엇:** 친구 그룹이 투자 취향으로 게임 캐릭터를 소환하고, 2인 파티를 이뤄 '오늘의 우정주'(테마)를 받고, 각자 한 줄 포지션을 남기면 AI 진행자가 파티를 요약하는 **게임형 투자 대화 앱**.
- **누구:** Z세대 친구 그룹 (비개발자 포함). 증권 지식 없어도 부담 없이.
- **톤 원칙:** "사세요가 아니라 얘기해보세요." 투자 조언 아님, 대화 소재.
- **타입:** 모바일 우선 메신저+SNS 앱. (대시보드/유틸 아님.)

## 기억에 남길 한마디

> **"친구랑 편하게 수다 떠는 곳."**

모든 디자인 결정은 이 한 문장에 복무한다. 차갑고 정밀한 핀테크가 아니라, 따뜻하고 친근한 메신저. 부담을 낮추는 게 1순위.

## 미감 방향

- **방향:** 따뜻한 채팅 (KakaoTalk × 토스 라이트).
- **장식 수준:** intentional — 큰 라운드, 부드러운 그림자, 절제된 이모지. 패턴/그라데이션 남용 없음.
- **무드:** 크림빛 종이 위의 말풍선. 둥글고 폭신하고 친근. 톡톡 튀지만 유치하지 않게.
- **레퍼런스:** KakaoTalk(말풍선·채팅 IA), Toss(둥근 카드·친근한 카피·바운시 모션).

## 타이포그래피

- **디스플레이:** **Cabinet Grotesk** (800/700) — 둥글고 친근한 지오메트릭. 헤더·캐릭터 클래스명·우정주 제목.
- **본문/UI:** **Pretendard** — 한글 가독성 최상. 본문, 라벨, 칩, 입력.
- **숫자(스탯 등):** Pretendard tabular-nums (별도 모노 안 씀 — 따뜻한 톤 유지).
- **로딩:** Cabinet Grotesk = Fontshare CDN, Pretendard = jsDelivr CDN. finz 레이아웃에서만 로드.
- **스케일(rem):** 12 / 14 / 15(본문) / 18 / 22 / 28 / 36(디스플레이). 행간 본문 1.5, 디스플레이 1.15, letter-spacing 디스플레이 -0.02em.

## 컬러

`--fz-*` 네임스페이스. emerald 계열 금지(공용과 시각 충돌).

- **배경:** `--fz-bg #FBF7F0` (따뜻한 크림)
- **서피스:** `--fz-surface #FFFFFF`, `--fz-surface-2 #FFF3EC` (코랄 틴트)
- **잉크:** `--fz-ink #2B2622` (소프트 다크브라운, 순검정 아님), `--fz-muted #8A7F76`
- **라인:** `--fz-line #EFE7DB`
- **액센트(코랄):** `--fz-coral #FF6B5C`, 텍스트용 `--fz-coral-ink #C8412F`, 틴트 `#FFEDE9`
- **서브(앰버):** `--fz-amber #FFC24B`, 틴트 `--fz-amber-tint #FFF6E4`, 텍스트 `#B6791B`
- **시맨틱:** success는 앰버계, error `#E05B4B`(코랄 다크), info는 코랄. 별도 채도 높은 색 추가 금지.
- **다크모드:** V0 미지원(라이트 단일). 추후 surface 재설계 시 채도 -15%.

## 모양 / 모션

- **라운드:** `--fz-r-sm 14` / `--fz-r 20` / `--fz-r-lg 28`(말풍선·큰 카드) / `--fz-r-full 999`(칩·버튼·아바타).
- **그림자:** 부드럽고 따뜻하게. `--fz-shadow 0 8px 24px -12px rgba(120,80,40,.22)`, `--fz-shadow-sm 0 3px 10px -6px rgba(120,80,40,.25)`.
- **모션:** 바운시·친근. 버튼/칩 탭 시 살짝 눌림(scale .96), 말풍선 등장 시 아래에서 톡 떠오름(translateY+fade, ease-out 220ms). 과한 choreography 없음.
- **easing:** enter `cubic-bezier(.2,.8,.2,1)`, exit ease-in. duration micro 90ms / short 180ms / medium 260ms.

## 정보구조 (메신저 + SNS)

화면을 "대시보드 카드 더미"가 아니라 **채팅 타임라인**처럼 읽히게.

- **캐릭터 = 프로필/스티커:** 원형 아바타 + 클래스명 + 스탯 미니바. 소환은 "캐릭터가 등장"하는 느낌.
- **우정주 = 말풍선:** '오늘의 우정주'는 진행자(FINZ)가 던지는 큰 말풍선 카드.
- **포지션 = 채팅 메시지:** 내 포지션은 오른쪽 코랄 말풍선, 상대는 왼쪽 흰 말풍선 (카톡 정렬). stance 는 이모지 칩.
- **AI 요약 = 진행자 마무리 말풍선:** 앰버 틴트로 톤 구분.
- **stance 칩:** 알약형, 선택 시 코랄 채움 + 그림자.

## 컴포넌트 토큰(핵심)

- **버튼:** primary = 코랄 채움 + 코랄 그림자, ghost = 흰 배경 + 라인. 모두 `--fz-r-full`.
- **칩(stance/태그):** 알약형, 1.5px 라인, 선택 시 코랄.
- **카드/말풍선:** 흰 서피스 + `--fz-line` 1px + `--fz-shadow-sm`, 라운드 `--fz-r-lg`.
- **스탯바:** 트랙 `--fz-surface-2`, 채움 코랄, 높이 7px, `--fz-r-full`.

## 기술적 독립 (아키텍처)

travel/secondwind 와 시각·구조 모두 분리:

1. **레이아웃 셸 분리:** finz 페이지를 `app/(site)/finz/` → **`app/finz/`** 로 옮겨 자체 `app/finz/layout.tsx` 를 둔다. 공용 `app/(site)/layout.tsx` 의 상단 nav(travel/FINZ 링크)를 **상속하지 않음**. URL 은 `/finz` 그대로(route group 변경이라 경로 불변).
2. **토큰 네임스페이스:** finz 컴포넌트는 `--fz-*` 만 쓴다. 공용 `--ink/--muted/--line/--accent`·emerald-* 참조 금지. (네임스페이스만으로도 cascade 격리됨.)
3. **전용 폰트:** Cabinet Grotesk / Pretendard 는 finz 레이아웃에서만 로드. 공용 폰트와 안 섞임.
4. **전용 globals:** `app/finz/finz-theme.css`(또는 layout 내 style)에서 `--fz-*` 정의. 공용 globals 의 토큰을 덮어쓰지 않고 별도 네임스페이스로 공존.
5. **API 무변경:** `app/api/finz/*` 는 그대로(디자인과 무관).

## 적용 대상 (개편 화면/컴포넌트)

`/finz`(시작·취향카드·캐릭터), `/finz/party`(생성), `/finz/party/[groupId]`(룸). 컴포넌트: taste-selector, character-builder, character-card, party-create, party-room, party-pick-result, party-positions, party-summary — 전부 `--fz-*` + 말풍선/칩/프로필 IA 로 재작성.

## 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-06-14 | 초기 디자인 시스템 생성(따뜻한 채팅) | `/design-consultation`. 사용자가 3안 중 "따뜻한 채팅(KakaoTalk×토스)" 선택. secondwind/travel 의 밝은 emerald 대시보드와 완전 분리 요구 → `--fz-*` 네임스페이스 + `app/finz/` 셸 분리로 독립. |
