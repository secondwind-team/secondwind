# FINZ 디자인 시스템 — 따뜻한 채팅 (Warm Chat)

> FINZ 전용 디자인 시스템. **secondwind / travel 과 완전히 독립**이다 — 토큰 네임스페이스(`--fz-*`), 전용 폰트, 전용 레이아웃 셸을 쓰고 공용 `--ink/--muted/--line/--accent` 나 emerald 팔레트를 절대 참조하지 않는다. UI/디자인 결정 전 이 문서를 먼저 읽는다.
>
> **2026-06-20 갱신: finz 가 4탭 메신저(친구·대화·피드·프로필)로 전면 개편됨.** 시작 화면 = 메신저. 그동안의 단계별 화면·단일 채팅방은 이제 **대화 탭 안의 한 요소**로 흡수됐다(채팅방 자체의 IA·시각 토큰은 그대로 유지). **계정·핸들 기반**(Google = 인증만, finz 가 계정·핸들·캐릭터 소유). 시각 토큰(폰트·컬러·모양·모션)은 무변경 — 바뀐 건 최상위 IA 다. 아래 [정보구조](#정보구조-4탭-메신저)·[기술적 독립](#기술적-독립-아키텍처)·[결정 로그](#결정-로그)를 먼저 본다.
>
> 이전 이력: 2026-06-14 `/design-consultation` 으로 "따뜻한 채팅" 생성 → 2026-06-15 카카오톡식 단일 채팅방으로 재구조화 + `@finz` 멘션 AI 답변 → 2026-06-20 `@finz` 가 의도 분류 라우터(pick/summary/position/chart/briefing/qa)로 진화 + 종목 차트(TradingView)·정기 브리핑(GH Actions cron) 추가(결정 로그 참조).

## 제품 맥락

- **무엇:** 친구를 핸들로 더하고 대화방에서 투자 취향 캐릭터로 만나 수다 떠는 **메신저형 투자 대화 앱**. '오늘의 우정주'(테마)·한 줄 입장·AI 요약·`@AI` 답변·레이드 같은 콘텐츠는 전부 **대화방 안 부가기능**이다.
- **시작 화면 = 4탭 메신저:** 친구(핸들로 추가) / 대화(방 목록·생성·초대 + "나와의 채팅") / 피드(친구 활동 타임라인) / 프로필(캐릭터·핸들·이력). 기존 "파티"는 대화 탭으로 흡수.
- **계정·핸들:** Google 로그인은 **인증만**, 계정·핸들·캐릭터는 finz 가 소유(provider-agnostic — 추후 다른 로그인도 같은 계정에 귀속). 캐릭터는 가입 후 **프로필에서 소환**.
- **대화방의 핵심 모델:** 방 안에선 **단일 append-only 타임라인이 곧 상태**다. "저장" 없음 — 우정주·입장·요약·자유 대화·`@finz` 답변·차트·시스템 알림이 한 타임라인에 쌓인다. 방마다 AI 봇이 상주(`@finz` 멘션을 **의도 분류**해 기능 실행 + 맥락 따라 선제 개입).
- **누구:** Z세대 친구 그룹 (비개발자 포함). 증권 지식 없어도 부담 없이.
- **톤 원칙:** "사세요가 아니라 얘기해보세요." 투자 조언 아님, 대화 소재. (`@finz` 답변·차트·시황 브리핑·선제 개입 끝에 "정보 참고용" 면책을 서버가 강제 부착.)
- **타입:** 모바일 우선. **4탭 셸 + 풀하이트 채팅방**(방 진입 시 탭바 위 풀블리드). 대시보드/유틸/단계별 폼 아님.

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

## 정보구조 (4탭 메신저)

**최상위 = 하단 탭 4개의 메신저 셸.** 로그인·온보딩 게이트를 지나면 4탭으로 들어간다. 대화방은 그 안(대화 탭)에서 여는 **풀하이트 채팅 화면**이다 — 단일 채팅방이 앱 전체가 아니라 "대화의 한 종류"로 내려갔다.

**셸 구조 (`app/finz/layout.tsx` → `app/finz/(tabs)/layout.tsx`):**

- **계정 게이트 (`finz-app-gate`):** 미로그인 → 로그인 뷰(`finz-login-view`) / 로그인했지만 계정 없음 → 온보딩(`finz-onboarding`, 핸들+표시이름) / 정상 → 4탭. 게이트가 ok 일 때만 탭·방이 마운트되므로 그 안에선 계정이 항상 존재(`useFinzAccount`).
- **`(tabs)/layout.tsx`:** 상단 타이틀(현재 탭명) + 스크롤 본문 + **하단 탭바 `.fz-tabbar`(4칸 고정, safe-area 대응)**.

**4탭:**

- **친구:** 핸들(`@xxx`)로 친구 추가·요청·수락 + 목록. 친구 행에서 바로 1:1 대화 시작. 행은 `.fz-list-row`.
- **대화:** 맨 위 **"나와의 채팅"(고정)** + 내 대화방 목록(최근 활동순) + "새 대화 시작" 시트(1:1/그룹, 친구 선택). 방을 탭하면 채팅방으로. 캐릭터 없으면 "프로필에서 소환" 안내.
- **피드:** 친구 활동을 SNS 타임라인처럼(가입·캐릭터 소환·우정주 생성·방 개설·챌린지). 카드는 `.fz-feed-card`. fan-in 조회.
- **프로필:** 그라데이션 헤더 `.fz-profile-header`(아바타·이름·핸들·소개) + 캐릭터 카드 + 편집(이름·소개·취향카드 재선택·핸들) + 이력 + 로그아웃. 캐릭터 없으면 "캐릭터 소환하기" CTA.

**대화방 (`/finz/party/[groupId]`, 탭바 밖 풀블리드):** 방 안은 **단일 append-only 타임라인 = 화면 = 상태**(2026-06-15 카카오톡식 채팅방 구조·시각 그대로 유지). `finz-party-room` 이 오케스트레이션.

- **상단 헤더(고정, `finz-chat-header`):** 뒤로(대화 목록) + 멤버 아바타(겹친 원형) + 상태/방이름 + **초대**(친구 선택 시트 또는 링크 복사). self 방은 초대 숨김.
- **가운데 타임라인(스크롤):** 메시지 누적. 내 행동엔 바닥 추적, 상대/봇은 바닥 근처일 때만(아니면 "새 메시지" 칩). `aria-live` 간결 알림.
- **하단 입력바(고정, `finz-chat-composer`):** 텍스트 + `+` 액션 시트(우정주 뽑기 / 내 입장 / 요약). `visualViewport` 키보드 추적. placeholder `@finz 로 질문`. 말풍선 속 `@finz`(별칭 `@핀즈`/`@AI`) 멘션 토큰은 **강조 칩(`.fz-mention`)**으로 렌더(내 코랄 말풍선=반투명 흰색, 상대 흰 말풍선=코랄 틴트).
- **합류:** 비멤버가 링크로 들어오면 **원탭 "대화방 들어가기"**(계정 캐릭터로 즉시 — 취향 재선택 없음, `finz-room-join-view`). 정원 초과(12)면 안내(`finz-room-full-notice`).
- **나와의 채팅(self):** 계정당 1개의 혼자 방(메모·AI 솔로 테스트용). nudge·초대 없음, 우정주는 2명 필요라 비활성.

**"이제 뭐 하지" 코칭(ephemeral nudge):** 대화방에서 현재 상태의 다음 행동(초대 → 우정주 뽑기 → 내 입장 → 요약)을 클라이언트가 매 렌더 계산해 **타임라인 맨 아래 단 하나의 finz 코칭 말풍선 + CTA**로 보여준다. **저장 안 함** — 상태가 진행되면 사라진다. self 방에선 생략.

## 채팅 메시지 종류

타임라인에 쌓이는 메시지(append-only). 정렬·스타일이 발신자에 따라 다르다:

| kind | 발신 | 정렬 / 스타일 |
|---|---|---|
| `text` (멤버) | 나 / 상대 | 나=오른쪽 코랄 `.fz-msg--me`, 상대=왼쪽 흰 `.fz-msg` + 이름 라벨 |
| `text` (finz) | AI 봇 | 왼쪽 + 🤖 아바타 + "FINZ" 라벨 — `@finz` 멘션 그라운딩 답변(qa, 출처·면책) + 시황 브리핑 + 선제 개입 발화 |
| `system` | 시스템 | 가운데 작은 회색 pill ("OO님이 들어왔어요" 등) |
| `pick` | finz 봇 | 왼쪽 + 🤖 아바타 + `.fz-bubble--pick`(코랄 틴트) 큰 우정주 카드 + 재추첨 ghost 버튼 |
| `chart` | finz 봇 | 왼쪽 + 🤖 아바타 — **TradingView 미니 차트 위젯**(실시간, 베이크 이미지 아님). 심볼만 저장(`{symbol,label}`), 데이터는 LLM 아닌 TradingView 제공(환각 방어). "정보 참고용" 면책 캡션. `finz-chart-bubble` |
| `position` | 멤버 | text 처럼 좌/우 정렬, stance 이모지 칩 + 코멘트. 같은 사람의 옛 입장은 흐리게, 최신은 "바뀐 입장" 태그 |
| `summary` | finz 봇 | 왼쪽 + 🤖 아바타 + `.fz-bubble--amber`(앰버 틴트) 마무리 말풍선 |

- **캐릭터 = 프로필/스티커:** 헤더의 겹친 원형 아바타(클래스 이모지) + 조인 뷰의 풀 캐릭터 카드(스탯 미니바).
- **AI 봇 = 의도 분류 라우터 + 상주형:** 메시지에 `@finz`(별칭 `@핀즈`/`@AI`)를 넣으면, 봇은 단순 Q&A 가 아니라 멘션을 **의도로 분류해 기능을 실행**한다(답/실행 오는 동안 `.fz-typing` 점 3개). 의도 = `pick`(우정주)·`summary`(요약)·`position`(입장)·`chart`(차트)·`briefing`(시황 구독)·`qa`(그라운딩 답변, 기본). 분류 실패·전제조건 미달은 전부 `qa` 로 폴백(동작이 나빠지지 않음). 멘션이 아니어도 멤버 대화가 쌓이면 **맥락을 읽고 선제 개입**한다(1회, 서버 쿨다운으로 빈도 제한). 봇 표시 라벨은 앱 정체성상 "FINZ" 유지(호출 표기 `@finz`, 인식은 `@finz`/`@핀즈`/`@AI` 모두).
- **stance 칩:** 알약형, 선택 시 코랄 채움 + 그림자. (입력바의 "내 입장" 모드에서 노출.)

## 컴포넌트 토큰(핵심)

`app/finz/finz-theme.css` 의 재사용 클래스(전부 `.finz-root` 스코프, `--fz-*` 만 사용):

- **버튼 `.fz-btn` / `.fz-btn--ghost`:** primary = 코랄 채움 + 코랄 그림자, ghost = 흰 배경 + 라인. 모두 `--fz-r-full`.
- **칩 `.fz-chip`(stance/태그):** 알약형, 1.5px 라인, 선택 시 코랄.
- **카드/말풍선 `.fz-card` / `.fz-bubble`(`--pick` 코랄·`--amber` 앰버):** 흰 서피스 + `--fz-line` 1px + `--fz-shadow-sm`, 라운드 `--fz-r-lg`. `.fz-bubble` 은 등장 모션(fzPop).
- **채팅 말풍선 `.fz-msg` / `.fz-msg--me`:** 좌측 흰색 / 우측 코랄(흰 글자), max-width 80%, 등장 모션. **채팅 타임라인의 기본 단위.**
- **타이핑 인디케이터 `.fz-typing`:** 점 3개 깜빡임(fzBlink). finz 가 픽/요약/차트/`@finz` 답변·선제 개입을 만드는 중 표시. reduced-motion 시 정지.
- **멘션 칩 `.fz-mention`:** 말풍선 속 `@finz`(별칭 `@핀즈`/`@AI`) 멘션 토큰을 메신저식 강조 칩으로 — 내 코랄 말풍선에선 반투명 흰색, 상대 흰 말풍선에선 코랄 틴트. `splitByMention` 순수 헬퍼로 분리.
- **스탯바 `.fz-statbar` / 아바타 `.fz-avatar` / 태그 `.fz-tag` / 입력 `.fz-input` / 알림 `.fz-alert`.**
- **메신저 셸(신규):** `.fz-tabbar` + `.fz-tabbar__item(--on)`(하단 4탭, safe-area), `.fz-list-row`(친구·대화방 행 + `__body/__title/__sub/__meta`), `.fz-feed-card`(피드 한 줄), `.fz-profile-header`(프로필 그라데이션 배너), `.fz-badge`(요청 수), `.fz-iconbtn`(둥근 액션 버튼), `.fz-empty(__emoji)`(빈 상태), `.fz-input--icon`(왼쪽 `@` 아이콘 입력 — `.fz-input` 의 shorthand padding 이 Tailwind `pl-*` 를 로드 순서상 덮어쓰므로, 같은 파일에서 뒤에 정의해 왼쪽 여백을 안전하게 확보).
- **모션 접근성:** `@media (prefers-reduced-motion: reduce)` 에서 말풍선/타이핑 애니메이션·부드러운 자동 스크롤 끔.

## 기술적 독립 (아키텍처)

travel/secondwind 와 시각·구조 모두 분리:

1. **레이아웃 셸 분리 + 4탭 라우팅:** finz 는 `app/finz/` 아래 자체 셸(공용 nav 미상속). `app/finz/layout.tsx`(테마·폰트·계정 게이트) → `app/finz/(tabs)/layout.tsx`(상단 타이틀 + 하단 탭바)가 4탭 `(tabs)/{friends,chats,feed,profile}` 을 감싼다. 대화방 `app/finz/party/[groupId]` 은 `(tabs)` 그룹 **밖**이라 탭바 없이 풀블리드. `/finz` 와 레거시 `/finz/party` 는 `/finz/chats` 로 리다이렉트.
2. **토큰 네임스페이스:** finz 컴포넌트는 `--fz-*` 만 쓴다. 공용 `--ink/--muted/--line/--accent`·emerald-* 참조 금지. (네임스페이스만으로도 cascade 격리됨.)
3. **전용 폰트:** Cabinet Grotesk / Pretendard 는 finz 레이아웃에서만 로드. 공용 폰트와 안 섞임.
4. **전용 globals:** `app/finz/finz-theme.css` 에서 `--fz-*` 정의. 공용 globals 의 토큰을 덮어쓰지 않고 별도 네임스페이스로 공존. (단, `.fz-input` shorthand padding 이 Tailwind `pl-*` 유틸을 로드 순서상 덮으니, 아이콘 입력은 `.fz-input--icon` 전용 클래스를 쓴다.)
5. **풀하이트 셸:** `.finz-root` 는 `flex flex-col` + `min-height:100svh`, `app/finz/layout.tsx` 의 `<main>` 은 `flex-1 min-h-0`. `(tabs)/layout.tsx` 는 헤더(flex-none) + 스크롤 본문(flex-1 min-h-0) + 탭바(flex-none)로 나눠 본문만 스크롤한다. 대화방은 `visualViewport` 높이로 정확히 채운다(매직넘버 calc 없음).
6. **계정·신원 계층:** 민감 작업(계정·친구·피드·방 생성·초대)은 NextAuth 세션으로 **서버 인증**(`lib/server/finz-account.ts` 의 `resolveAccount`/`requireAccount`), 방 안 채팅은 기존 `memberId = accountId` 신뢰 모델 유지. 클라이언트는 `finz-account-context` 로 계정을 들고 게이트 분기. Google 은 인증 제공자일 뿐 — provider-agnostic(아래 데이터 모델).

### 채팅·신원 아키텍처 — 디자인 함의

UI 작업 전 알아둘 데이터 모델(상세는 코드 주석 참조). 저장소가 역할별로 둘로 나뉜다:

- **Neon Postgres — 영구 소셜 신원** (`lib/server/finz-account-store.ts`, 런타임 `CREATE TABLE IF NOT EXISTS`): `finz_accounts`(accountId PK, handle UNIQUE, displayName, selectedCardIds, bio) · `finz_auth_links`(provider, providerId → accountId; **provider-agnostic**) · `finz_friendships`(requester/addressee/status) · `finz_feed_events`(actor/type/title/roomId). 친구·핸들은 TTL 없음. 캐릭터는 account 의 `selectedCardIds` 로 렌더 시 재구성(빈 배열=캐릭터 없음 → 프로필에서 소환).
- **Upstash Redis — 대화방·메시지(TTL 30일)** (`finz-group-store`/`finz-chat-store`): `sw:finz:group:<id>`=방 신원(멤버 + kind `1on1`/`group`/`self` + title) · `sw:finz:chat:<id>`=메시지 LIST(원자적 append, 방 멤버 `memberId = accountId`) · `sw:finz:rooms:<accountId>` ZSET="내 방 목록"(최근순) · `sw:finz:self:<accountId>`=나와의 채팅 포인터. 화면은 LIST 를 폴링(보임 3s/숨김 8s) → **모든 방 UI 는 "append-only 타임라인" 전제**(되돌리기·편집 없음).
- **AI:** `POST .../intent` = `@finz` 멘션을 `pick`/`summary`/`position`/`chart`/`briefing`/`qa` 로 분류하는 라우터(constrained enum 출력, temperature 0, 비그라운딩·cheap, 동시성 락, 실패·미달 시 `qa` 폴백). 분류 후 각 기능은 기존 서버 가드·락을 그대로 거친다. `POST .../ask` = `qa` 그라운딩 답변(Google Search 실시간, 출처·면책), `POST .../chart` = `kind:"chart"` 메시지 append(심볼은 `normalizeChartSymbol` 정규화 + 서버 재검증, 데이터는 TradingView), `POST .../briefing/subscribe` = 방의 시황 구독 토글, `POST .../proactive` = 그라운딩 없이 맥락 보고 1회 선제 개입(쿨다운 락). 픽(우정주)은 theme-only 환각 방어 유지. **면책 문구·인젝션 가드·members-guard·동시성 락은 서버 불변식.**
- **정기 브리핑(스케줄러):** 구독 방은 `sw:finz:briefing:<id>:rooms` SET 로 관리(`lib/server/finz-briefing-store.ts`). 매일 09:00 KST GitHub Actions cron(`.github/workflows/daily-briefing.yml`, `0 0 * * *` UTC)이 보안 엔드포인트 `GET /api/finz/cron/briefing`(Bearer `CRON_SECRET`)를 호출 → 그라운딩 LLM 1회로 시황(300자+출처)을 생성해 구독 방에 finz 메시지로 전송. 날짜 기반 멱등 락(중복·중복 LLM 방어), 구독자 0이면 LLM 스킵. `CRON_SECRET` 은 Vercel·GitHub 양쪽에 같은 값으로 **수동 설정** 필요(없으면 시황만 안 옴, 앱은 정상).

## 적용 대상 (화면/컴포넌트)

- **셸·게이트:** `app/finz/layout.tsx`(계정 provider + 게이트), `app/finz/(tabs)/layout.tsx`(탭바), `finz-account-context`, `finz-app-gate`, `finz-login-view`, `finz-onboarding`(핸들).
- **4탭:** `(tabs)/friends`(친구), `(tabs)/chats`(대화 + `finz-new-chat-sheet`), `(tabs)/feed`(`finz-feed-list`), `(tabs)/profile`(`finz-profile-view`).
- **대화방 (`/finz/party/[groupId]`):** `finz-party-room`(오케스트레이터·폴링·낙관적 전송·nudge·`@finz` 인텐트 라우팅·차트·선제 개입), `finz-chat-header`, `finz-chat-timeline`, `finz-chat-message-view`(kind별, `chart` 포함), `finz-chat-composer`, `finz-chart-bubble`(TradingView 위젯), `finz-nudge-bubble`, `finz-position-input`, `finz-room-join-view`(원탭 합류), `finz-invite-sheet`(친구 초대/링크), `finz-room-full-notice`.
- **재사용:** `finz-character-card`(헤더·프로필·조인 아바타), `finz-party-pick-result`(픽 말풍선), `finz-party-summary`(요약 말풍선), `finz-chart-bubble`(TradingView 차트 말풍선), `finz-character-builder`(프로필의 캐릭터 소환).
- **API:** `account`(+`/handle`), `friends`, `feed`, `rooms`(+`/[groupId]/invite`·`/join`·`/self`), `party/[groupId]/{message,chat,ask,intent,proactive,pick,pick/summary,position,chart,briefing/subscribe,join}`, `cron/briefing`(스케줄러 전용, Bearer).
- **레거시/보류:** `finz-taste-selector`·`finz-party-create`·`finz-join-view`·`finz-party-id`(옛 솔로/익명 흐름 — 라우트 리다이렉트로 비노출, 코드만 잔존). `finz-party-positions` 는 폐지(타임라인 position + composer 입장 모드로 대체).

## 결정 로그

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-06-14 | 초기 디자인 시스템 생성(따뜻한 채팅) | `/design-consultation`. 사용자가 3안 중 "따뜻한 채팅(KakaoTalk×토스)" 선택. secondwind/travel 의 밝은 emerald 대시보드와 완전 분리 요구 → `--fz-*` 네임스페이스 + `app/finz/` 셸 분리로 독립. |
| 2026-06-15 | **단계별 화면 → 카카오톡식 채팅방으로 재구조화** | 사용자: "작동이 메신저 같지 않고 뭘 할지 모르겠다. 채팅방을 기본 컨셉으로, 실제 대화도, '저장' 말고 채팅으로 기록." → 단일 append-only 타임라인이 곧 상태. 풀하이트 메신저 셸 + ephemeral nudge 로 "다음 행동" 상시 안내. 시각 토큰은 유지, IA 만 채팅으로 전환(`.fz-msg` 가 기본 단위로 승격). 설계·구현 모두 적대적 워크플로로 검증. |
| 2026-06-15 | **`@finz` 멘션 → AI 실시간 답변(Google Search 그라운딩)** | 사용자: "@finz 멘션 시 오늘 주가·뉴스 등 질문에 반드시 답하게." → 그라운딩 없이는 시세·뉴스를 환각하므로 `googleSearch` 툴로 사실 답변(출처 표기). 우정주 픽은 theme-only 환각 방어 유지(그라운딩은 Q&A 한정). 자유 텍스트가 처음으로 LLM 에 닿음 → 인젝션 가드(구조화 데이터·system 가드)·면책 서버 불변식·members-guard·동시성 락. 2인 신뢰 파티 기준 수용. |
| 2026-06-19 | **카카오톡식 단일 채팅방 → 4탭 메신저로 전면 개편** | 사용자: "finz 를 완전한 메신저로. 친구·대화·피드·프로필 4탭, 우정주·레이드는 대화방 안 부가기능, 각 방에 AI 봇 상주(`@AI` 멘션 + 맥락 선제 개입)." → 단일 채팅방을 "대화 탭 안 한 요소"로 내리고, 계정·핸들·친구 그래프·피드(Neon)를 신규 구축. 검증된 채팅 코어(append-only·폴링·락)·시각 토큰(`--fz-*`)은 그대로 재사용, `group→room` 일반화(N인·kind·방 인덱스). 식별: Google=인증만, finz 가 계정 소유(provider-agnostic — 추후 다른 로그인 귀속 가능). 민감 작업만 세션 인증, 방 채팅은 기존 `memberId=accountId` 신뢰 모델. |
| 2026-06-19 | **온보딩에서 캐릭터 분리(계정 먼저) + "나와의 채팅"(self)** | 사용자: "캐릭터 소환을 먼저 하고 계정 만드는 게 아니라, 계정 다 만들고 프로필에서 따로 소환. 그리고 매번 사람 모으지 않게 나와의 채팅." → 온보딩은 핸들(+이름)만, 계정은 캐릭터 없이 생성 가능(검증 0개 또는 3개+). 캐릭터는 프로필에서 소환(없으면 대화 기능이 소환 유도). 계정당 1개 self 방으로 `@finz`·선제 개입을 혼자 테스트(우정주는 2명 필요라 self 에선 비활성). |
| 2026-06-20 | **`@finz` = 의도 분류 라우터 + 종목 차트 + 정기 브리핑** | `@finz` 멘션을 무조건 Q&A 로 보내던 것을 LLM 의도 분류 라우터로 진화 — `pick`/`summary`/`position`/`chart`/`briefing`/`qa` 로 분류해 자연어로 기능 실행(constrained enum·temperature 0, 실패·미달은 `qa` 폴백이라 동작 악화 없음). 차트는 시세를 LLM 이 환각하지 않게 데이터를 TradingView 위젯에 맡기고(append-only `kind:"chart"`, 심볼만 저장·정규화·서버 재검증), 정기 브리핑은 Vercel Hobby cron 제약을 GitHub Actions cron + Bearer(`CRON_SECRET`) 보안 엔드포인트로 우회(무료, 날짜 멱등 락). 자유 텍스트가 LLM 에 닿는 표면이 늘어 인젝션 가드·면책 서버 불변식 유지. 적대적 리뷰로 검증. |
| 2026-06-20 | **대화 진입 SSR 시드 + Vercel 함수 리전 서울 정렬** | 함수가 us-east(iad1)에서 돌고 사용자는 서울이라 동적 호출마다 태평양 왕복(~250ms+)이 주 병목(측정). 계정 상태·방 목록을 레이아웃에서 SSR 로 시드해 첫 `/api/finz/account`·`/api/finz/rooms` 왕복 제거, `resolveAccount` 를 React `cache()` 로 요청 단위 메모이즈, `vercel.json` `regions:["icn1"]`(서울)로 함수를 사용자 가까이 정렬. (계정 SSR 로 finz 셸은 동적 렌더 — 의도된 트레이드오프. DB 는 Upstash 도쿄/Neon 싱가포르.) | |
