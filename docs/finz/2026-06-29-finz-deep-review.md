# finz 심층 리뷰 — UI/UX·코드베이스 다각도 진단 (2026-06-29)

> 10개 전문 관점으로 finz(~14,000줄: 컴포넌트 5.6k · API 라우트 3.2k · lib 4.6k · CSS 519)를 병렬 분석하고, 각 발견을 실제 코드와 대조해 적대적 검증한 결과를 종합한다. 검증 통과 발견 **74개**(거부 1). 코드 변경 없음 — 진단·권고만.
>
> 방법: 관점별 분석 에이전트 → 발견별 검증 에이전트(코드 대조, 근거 없으면 기본 거부) → 종합. 모든 권고는 이 팀 제약(개발자 2 + 비개발자 2, 데모 먼저, 작은 PR, 의존성 최소, `--fz-*` 토큰, 프로토타입에도 프로덕션 기준)에 맞춰 작성.

---

## 0. 한 줄 요약

finz 는 **엔지니어링 기본기(디자인 토큰 규율·환각/인젝션 방어·동시성 락·타입 안전)가 프로토타입 치고 매우 단단한** 제품이다. 문제는 코드 썩음이 아니라 **세 곳에 집중된 구조적 공백**이다: ① 첫 가치까지의 깔때기 마찰, ② 읽기 경로 권한 가드 부재(금융 개인정보 노출), ③ @finz 응답 체감 지연. 여기에 ④ 기능 과잉으로 thesis 가 흐려지는 제품 리스크가 겹친다. 대부분 **작은 변경(S)으로 큰 체감 개선**이 가능하다.

---

## 1. 관점별 점수 (검증 반영)

| 관점 | 점수 | 핵심 한 줄 |
|---|:--:|---|
| 채팅 핵심 루프·@finz UX | 7 | 낙관적 전송·폴백·인젝션 방어 탄탄. 체감 지연이 유일한 큰 약점 |
| 비주얼 디자인·접근성 | 7 | `--fz-*` 토큰 규율 모범적(하드코딩 hex·emerald 누수 0). 키보드 포커스만 구멍 |
| API·데이터 모델 | 7 | append-only + 원자 락 영리함. 정합성 잠복 결함 몇 개 |
| AI/LLM 통합 | 7 | 환각/인젝션 방어 다층. 쿼터 미기록이 큰 누수 |
| 코드 품질·테스트 | 7 | 순수 로직 품질 좋음(any 0). 라우트 테스트 0 + 레거시 잔존 |
| UX·온보딩 | 6 | 방 안 nudge 사다리 탁월. 깔때기 위쪽이 막다른 길투성이 |
| 프론트엔드 아키텍처 | 6 | party-room God Component(629줄) + 훅 부재 |
| 보안·프라이버시 | 6 | 쓰기는 막혔으나 **읽기 가드 전무** |
| 성능·확장성 | 6 | 영리한 모델이나 폴링×전체창×도쿄 왕복의 곱셈 구조 |
| 제품 전략·응집성 | 6 | 우정주 wedge 는 또렷, 8개 intent 가 그걸 묻음 |

**종합 ≈ 6.5/10** — "바닥(기본기)이 높고 천장(완성도)에 구멍이 난" 형태. 구멍이 작고 국소적이라 빠르게 메울 수 있다.

---

## 2. 강점 — 무너뜨리지 말 것

이 항목들은 의도적으로 잘 설계됐고, 향후 변경 시 보존해야 한다.

- **디자인 토큰 규율**: 컴포넌트 전수에서 emerald·공용 토큰 누수 0, 하드코딩 hex 0. 손익색조차 `--fz-gain/--fz-loss`로 finz 네임스페이스 안에 둠. DESIGN.md 모션 명세(fzPop·scale .96·fz-typing)가 코드에 정확히 구현.
- **방 안 nudge 사다리**(`computeNextNudge`): 방 상태(멤버 수·픽·입장)를 읽어 "지금 할 단 하나"만 CTA 로 제시하고, 행동 불가하면 침묵. 비개발자가 헤매지 않게 하는 핵심 장치.
- **append-only + 원자 락**: 단일 `rpush`만, `rpush+lset` 2단계 금지. 모든 LLM 표면에 `SET NX` 락(force 재추첨까지 reroll-lock 으로 레이스 차단). 코드 주석이 "왜 이렇게 했나"를 정직하게 문서화.
- **환각 방어 다층**: 픽=`responseSchema` enum 으로 theme-only 강제(디코딩 단계 차단), 차트=TradingView(LLM 아님), 포트폴리오 평단·손익=순수 함수 결정적 계산. "대화 not 매매" 신뢰의 핵심 레버.
- **프롬프트 인젝션 방어**: 모든 사용자 입력을 `JSON.stringify` 데이터로만 전달, 지시는 system 에만. speaker 는 서버 role 에서만 도출(가짜 `finz:` 위장 불가).
- **면책 서버 불변식 + graceful degradation**: 모델이 면책을 빠뜨려도 서버가 강제 부착. 모든 LLM 경로에 deterministic 폴백.
- **타입 안전**: finz 전체 `any` 0개. KV/Neon 경계마다 `isFinz*` 런타임 가드.
- **민감 작업 세션 경계**: 친구·피드·푸시·방 생성/초대는 NextAuth 세션 서버 검증, 클라 accountId 불신.

---

## 3. 횡단 테마 7개 (여러 관점이 같은 뿌리를 가리킴)

### T1. 첫 가치까지의 깔때기 마찰 — `[가장 시급]`
신규 사용자가 시그니처 경험(둘의 조합으로 '우정주')에 닿기까지 **캐릭터 소환 + 친구 수락 + 2인 정원**이라는 3중 게이트를 넘어야 한다. 게다가:
- 로그인·온보딩 직후 착지점이 '대화' 탭인데 신규 계정은 캐릭터가 없어 **즉시 막다른 빈 상태**.
- 온보딩은 "핸들만 정하면 시작"이라 **약속하지만** 캐릭터 소환이라는 숨은 관문이 더 있음(기대-현실 불일치).
- 초대 링크로 온 친구가 캐릭터 없으면 **합류가 조용히 실패하고 빠져나갈 링크조차 없는 dead-end**.
- self('나와의 채팅')는 "먼저 둘러보기"용인데 캐릭터 게이트 뒤 + 우정주 비활성이라 aha 를 못 줌.
→ 관련: UX 7건 중 5건, Product 3건. **데모/도그푸딩 자체가 막히는 1순위 테마.**

### T2. 읽기 경로 권한 가드 부재 = 금융 개인정보 노출 — `[가장 위험]`
쓰기 라우트는 members-guard 가 일관되게 있으나 **방 타임라인 읽기(`party/[groupId]` GET, `chat` GET)에는 멤버 검증이 전혀 없다.** 6자리 그룹 ID만 알면(링크 유출·열거) 비멤버가 두 사람의 전체 대화 + **포트폴리오 카드(실제 보유 종목·수량·매수가)** + 한줄입장을 읽는다. Vercel Deployment Protection 을 의도적으로 끈 공개 환경 + 무레이트리밋이라 표본형 남용에 노출. impersonation(타인 명의 메시지/거래), 오픈조인(링크=영구 입장권)도 같은 뿌리.
→ 관련: Security 7건. **신뢰가 핵심인 금융 앱에서 가장 먼저 닫아야 할 표면.**

### T3. @finz 응답 체감 지연 — "친구처럼" 느낌을 깎는 곳
@finz 멘션 후 **의도 분류(~1s LLM) 동안 타이핑 인디케이터가 전혀 없어** 봇이 죽은 것처럼 보인다. 차트/브리핑/스케줄/포트폴리오 일부는 응답이 폴링으로만 떠 최대 3초+ 무반응. 정상 빠른 연속 전송이 800ms 레이트리밋에 막혀 "전송 실패"로 표시. 선제 개입이 마지막 발화자 한쪽에서만 트리거돼 타이밍이 들쭉날쭉.
→ 관련: Chat core 4건 + Frontend `aiBusy` 누락. **데모 첫인상을 좌우하는데 대부분 S 변경.**

### T4. 쿼터·비용 누수 — 조용히 한도를 앞당기고 무응답을 만든다
finz 라우트들은 `getBlockedModels()`를 **읽기만 하고 429 를 `markBlocked()`로 기록하지 않는다**(travel 만 기록). Gemini free-tier(flash rpd 250)에 닿으면 매 멘션이 flash→flash-lite 로 429 를 반복(멘션당 최대 4회 헛호출) → "finz 가 계속 답을 못 함". 여기에 폴링마다 전체창 LRANGE, 전송당 도쿄 6~7 왕복, 비멘션마다 proactive 헛호출, 방 열린 동안 60초 recurring tick 상시, 타임라인 비메모 재렌더가 곱해진다.
→ 관련: AI/LLM 1건(high) + Perf 6건. **데모 중 "왜 안 돼"의 숨은 원인 + 확장성 천장.**

### T5. 기능 과잉 → thesis 희석 (CEO)
한 채팅방 봇이 **8개 intent**(pick/summary/position/chart/briefing/schedule/portfolio/qa)를 떠안아 정체성이 "협력적 투자 수다"에서 "뭐든 되는 AI 봇"으로 번진다. portfolio(평단·실현손익·섹터)는 "대화 not 매매"와 정면 충돌, schedule(물 마시기·스트레칭)은 "리마인더 봇" 정체성. 핵심 wedge(우정주)가 7개 유틸에 묻힘. 피드는 broadcast-only(좋아요·댓글 없음)라 성장 루프가 안 닫힘.
→ 관련: Product 6건. **빼기로 더 또렷해지는 영역.**

### T6. 레거시 이중 모델 + 테스트 공백
메신저 피벗 후 **죽은 레거시 체인**(localStorage memberId: finz-party-create/taste-selector/join-view/party-id + /api/finz/party·party-join)이 NextAuth accountId 모델과 공존. `finz-store`(email-PK)↔`finz-account-store`(accountId) 신원 저장소 이원화. group/room/party 3중 네이밍. 그리고 **오케스트레이션 3,164줄(38 라우트)에 라우트 테스트가 0** — Flash Lite 출력 흔들림에 라우트 파싱이 직접 노출되는데 회귀 탐지가 수동 QA뿐.
→ 관련: Code 6건 + Frontend(God Component). **두 개발자가 "어느 경로가 진짜냐"를 매번 재확인하는 인지 부채.**

### T7. 데이터 정합성 잠복 결함
`HARD_CEILING` off-by-one 으로 실링 도달한 활발한 방에서 **첫 메시지(seq=0)가 영구히 가려짐**(부분 뷰에서 결정 로직 오작동 우려). clientId 멱등이 꼬리 24개로만 동작(빠른 방 중복 메시지). **Neon 계정 생성에 트랜잭션이 없어 orphan 계정(로그인 영구 불가)** 가능. 1on1 방 동시 생성 시 중복. seq=LIST 인덱스는 LTRIM 도입 즉시 깨지는 잠복 함정(현재 미발동, 문서화됨).
→ 관련: API/data 8건.

---

## 4. 우선순위 로드맵 (이 팀이 실제로 할 수 있는 안)

### 🟢 Quick wins — 작은 변경(S), 데모 체감 큰 것부터
1. **[보안 H] 방 읽기 멤버 가드 추가** — `party`/`chat` GET 에 쓰기 라우트와 동일한 members-guard 복사. T2 의 80%를 한 PR로 닫음. *(S)*
2. **[채팅 H] @finz 분류 중 타이핑 인디케이터** — `handleMention` 진입에 `mentionBusy` 한 플래그 ON, 기존 `.fz-typing` 재사용. 데모 체감 최대. *(S)*
3. **[AI H] 429 → `markBlocked` 기록** — `recordLlmBlocks(result.rateLimitHits)` 헬퍼 한 개를 finz 라우트가 `recordCall` 옆에서 호출. 쿼터 소진 시 무의미한 재시도 제거. *(S)*
4. **[UX H] 신규(캐릭터 없는) 계정 착지점 분기** — `finz/page.tsx`에서 캐릭터 유무로 첫 진입을 /profile 로. *(S)*
5. **[UX H] 초대 합류 dead-end 탈출구** — join 에러 `my-character` 시 '캐릭터 만들기' Link(/profile) 노출. *(S)*
6. **[비주얼 H] 키보드 포커스 전역 규칙** — `finz-theme.css`에 `.finz-root :focus-visible{outline:2px solid var(--fz-coral);outline-offset:2px}` 한 곳. WCAG 2.4.7. *(S)*
7. **[채팅 M] 800ms 레이트리밋 → 자동 재전송/부드러운 안내** — `sendText` catch 를 429 분기로 분리, ~900ms 뒤 1회 자동 재전송. *(S)*
8. **[API M] HARD_CEILING off-by-one** — `INITIAL_WINDOW = HARD_CEILING+1` 한 줄(또는 안내 메시지를 rpush 안 함). seq=0 가림 해소. *(S)*
9. **[성능 M] proactive 쿨다운 우선 체크** — `acquireProactiveLock` 을 전체창 읽기보다 먼저 시도해 헛호출 시 LRANGE 생략. *(S)*

### 🟡 Near-term — 핵심 루프·안정화(M)
10. **[UX H] 온보딩 정합화** — (A) 취향카드 선택 1스텝 추가(진짜 '시작 가능' 계정) 권장, 또는 (B) 카피를 2단계로 정직화. *(M)*
11. **[API H] Neon 계정 생성 트랜잭션화** — 두 INSERT 를 CTE/`sql.transaction`으로 원자화. orphan 계정 차단. *(M)*
12. **[성능 H] 폴링 델타 읽기** — `afterSeq` 유효 시 `LRANGE max(0,afterSeq+1)..-1`만, LLEN 무변화면 즉시 빈 배열. 전체창은 ask/summary/proactive 만. *(M)*
13. **[성능 H] 전송 경로 왕복 묶기** — group GET 재사용 + rpush+expire×2+zadd 를 한 pipeline, llen 을 rpush 반환값으로 대체. 전송당 6~7→3~4 왕복. *(M)*
14. **[보안 M] 쓰기 라우트 세션=memberId 강제** — `requireRoomMember(groupId, req)` 공통 헬퍼. 우선 N인 group 방부터(2인 레거시는 데모 마찰 회피로 유지). T2 의 impersonation/오픈조인 마무리. *(M)*
15. **[제품 H] aha 앞당기기** — self 방 또는 캐릭터 없이 '우정주 미리보기' 1회 허용. 첫 픽까지 클릭 수↓. *(M)*
16. **[제품 H] intent 노출 강등** — 우정주 루프(pick/position/summary)+qa 를 1급(composer·nudge), chart/portfolio/briefing/schedule 은 '실험 기능'으로 구분. 코드 삭제 말고 노출 정리. *(M)*

### 🔵 Bigger bets — 구조·검증(L, 데모 후)
17. **[코드 H] 라우트 결정 로직 순수 함수화 + 단위 테스트** — portfolio/handle·pick 핫스팟부터. LLM 은 callLlm 주입/모킹. *(L)*
18. **[프론트 H→M] party-room(629줄) 분해** — `useFinzRoomPolling`·`useFinzRoomActions`(11개 fetch 핸들러를 데이터 테이블로). UI 무변경 순수 리팩터. *(L)*
19. **[코드 M] 레거시 memberId 체인 삭제** — finz-party-create/join-view/taste-selector/party-id + /api/finz/party(POST)·party/[groupId]/join. 사용자 무영향(이미 redirect). *(M)*

---

## 5. 무엇을 빼야 더 나아지나 (CEO 렌즈)

- **임의 schedule(물 마시기·스트레칭)** → 투자 맥락으로 좁히거나('장 마감 요약', '월요일 관심종목 체크') 실험 플래그로 강등.
- **portfolio 개인 손익 추적** → '함께 본 종목 얘기하기'(공동 대화 소재)로 재프레이밍하거나 별도 실험. **한 화면에서 '수다 앱'과 '손익 앱'을 동시에 주장하지 말 것.**
- **raid/challenge 미구현 훅** → '실험 백로그'로 명시. 검증할 게임화 하나(예: 입장 다 모이면 '미션 완료' 축하)만 작게.
- **피드 broadcast-only** → '나도 이 테마로 얘기하기' 원탭 하나로 피드→대화 루프를 닫아 4탭 thesis 의 성장 가설을 데모에서 검증.
- 빼기 결정은 **office-hours 로 thesis 재확인 + 도그푸딩 사용 데이터**로 — 지금 코드를 지우기보다 노출을 강등해 데이터를 모은 뒤 결정.

---

## 6. 방치 시 가장 큰 리스크

1. **포트폴리오·대화 무인증 노출**(T2) — 친구에게 보여줄 금융 앱에서 신뢰가 한 번에 무너짐.
2. **쿼터 소진 시 finz 무응답**(T4) — 데모 도중 "finz 가 답을 안 해"가 재현.
3. **orphan 계정**(T7) — 친구 가입이 영구 잠겨 수동 개입 없이 못 풀림.
4. **첫 가치 3중 게이트**(T1) — 도그푸딩·데모 자체가 시작점에서 막힘.

---

## 7. 부록 — 검증 통과 발견 74개 (관점별)

표기: `[심각도/노력]`. 심각도 critical>high>medium>low>nit, 노력 S<M<L<XL. 위치·권고 요약.

### UX·온보딩 (점수 6)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/S|온보딩 직후 착지점이 즉시 막힌 빈 상태|finz/page.tsx:4, finz-chats-client.tsx:16|신규는 /profile 로 분기|
|H/M|"핸들만 정하면 시작" 약속 vs 캐릭터 게이트 불일치|finz-onboarding.tsx:89, finz-chats-client.tsx:16|취향카드 1스텝 추가 or 카피 정직화|
|H/S|초대 친구 캐릭터 없으면 합류 dead-end|finz-room-join-view.tsx:47, finz-party-room.tsx:202|'캐릭터 만들기' Link 노출|
|M/M|신규에게 '지금 어디부터' 앱 수준 코칭 부재|(tabs)/layout.tsx:8|프로필 탭 점 뱃지 or 1줄 배너|
|low/M|친구 데려오는 행위가 방 안에만 숨음|finz-invite-sheet.tsx, friends/page.tsx:121|친구 탭에 '내 핀즈 링크 공유'|
|low/S|되돌리기·취소 부재(거절·로그아웃)|friends/page.tsx:79, finz-profile-view.tsx:121|가벼운 확인/되돌리기 토스트|
|low/M|self 가 캐릭터 게이트 뒤라 '둘러보기' 불가|finz-chats-client.tsx:35|self 항상 노출 or 보조 CTA|

### 비주얼 디자인·접근성 (점수 7)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/S|키보드 포커스 표시 부재(focus-visible 0)|finz-theme.css:238|전역 :focus-visible 규칙 1개|
|M/S|작은(10~11px) muted 텍스트 대비 경계선|finz-chat-message-view.tsx:34, portfolio-card.tsx:130|12px↑ or --fz-muted 한 단계 진하게|
|low/S|`rounded-[20px]/[14px]` 매직넘버 10여 곳|pick-result·character-card·taste-selector 등|`var(--fz-r)`/`var(--fz-r-sm)` 치환|
|low/S|active:scale 카드가 reduced-motion 밖|taste-selector:204, character-builder:52|reduced-motion 블록에 편입|
|low/S|summary 카드만 인라인 hex(#fbe6bd)|finz-party-summary.tsx:15|--fz-amber-line 토큰화|
|low/S|포트폴리오 바 의미 전달이 색·길이뿐|finz-portfolio-card.tsx:30|role=progressbar+aria 추가|
|nit/M|다크모드 부재(야간 크림 눈부심)|finz-theme.css:8|지금 만들지 말 것, 결정로그 메모만|

### 채팅 핵심·@finz UX (점수 7)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/S|분류(~1s) 동안 타이핑 인디케이터 없음|finz-party-room.tsx:234|mentionBusy 플래그 OR|
|M/S|차트/브리핑/스케줄 응답 폴링만(무방비 지연)|finz-party-room.tsx:351|mentionBusy 유지 + 분기 후 refetch|
|M/S|빠른 연속 전송이 800ms 리밋에 '전송 실패'|finz-chat-store.ts:29, party-room:229|429 자동 재전송/부드러운 안내|
|M/M|선제 개입이 마지막 발화자 한쪽만 트리거|party-room:239, proactive:42|폴링 루프에서 디바운스 트리거|
|low/L|상대 '사람' 타이핑 인디케이터 없음|finz-chat-timeline.tsx:181|지금 비권장(폴링 비용), 피드백 후|
|low/M|차트 가드 안내가 휘발성 에러 줄에만|party-room:398|system pill 로 타임라인에 남기기|
|low/S|qa 폴백 시 의도와 다른 결과 설명 없음|intent/route.ts:83, party-room:297|차트 폴백에 안내 재사용|

### 프론트엔드 아키텍처 (점수 6) *(이 관점은 분석 에이전트 요약이 불완전했으나 발견 7건은 모두 검증됨)*
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/L|party-room God Component(629줄)|finz-party-room.tsx:200-542|useFinzRoomPolling/Actions 추출|
|low/S|aiBusy 가 일부 @finz 액션 누락|finz-party-room.tsx:591|공유 busy 플래그|
|low/M|커스텀 훅 부재, effect 인라인(테스트 불가)|finz-party-room.tsx:87|폴링/푸시 훅 추출|
|low/S|메시지 뷰 비메모(모바일 jank)|finz-chat-message-view.tsx:60|React.memo + mentionNames useMemo|
|low/S|마운트 1회 스크롤, nowIso 매 렌더|finz-chat-timeline.tsx:98|ResizeObserver, nowIso useMemo|
|nit/M|FinzRoomSettings 단일 대형 파일(525)|finz-room-settings.tsx|RecurringForm 분리|
|nit/S|AccountContext value 인라인 객체|finz-account-context.tsx:54|useMemo value|

### API·데이터 모델 (점수 7)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/M|Neon 계정 생성 트랜잭션 부재 → orphan 계정|finz-account-store.ts:195|CTE/transaction 원자화|
|M/S|HARD_CEILING off-by-one(seq=0 영구 가림)|finz-chat-store.ts:30,304|INITIAL_WINDOW+1|
|M/S|clientId 멱등 꼬리 24개 한정(중복 메시지)|finz-chat-store.ts:104|직전 비교 or TTL SET NX dedup|
|M/M|런타임 CREATE TABLE/ALTER(FK 부재, 추적난)|finz-account-store.ts:40, finz-store.ts:40|정착 ALTER 제거, CASCADE FK, 단일 진실원천 문서|
|low/M|라우트 인증·검증·응답코드 불일치(미설정/오류 둘 다 503)|account/rooms/pick/message route|jsonError/jsonOk 헬퍼, 응답 규약 문서|
|low/S|touchRoomActivity 가 음소거 무관 ZSET 끌어올림|finz-group-store.ts:321|음소거 방 제외/하단|
|low/M|findExisting1on1 내 인덱스만 스캔(중복 방)|rooms/route.ts:80|페어 키 SET NX dedup(self 패턴 재사용)|
|low/S|seq=LIST 인덱스, LTRIM 도입 시 붕괴(잠복)|finz-chat-store.ts:2|가드레일 문서화(incr seq 전환 지침)|

### AI/LLM 통합 (점수 7)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/S|429 미기록 → 쿼터 소진 시 매 멘션 429 반복|quota-store.ts:91, 모든 finz 라우트|recordLlmBlocks(hits) 헬퍼|
|M/S|그라운딩 출처가 title 만(URI 없음)|ask/route.ts:109, briefing:100|마크다운 링크로(기존 finz-markdown 재사용)|
|M/M|현재가 통화/시장 검증 없음(잘못된 화폐 손익)|portfolio/handle:296, finz-portfolio.ts:346|거래소별 통화 명시 + 자릿수 sanity check|
|M/M|부작용 intent(briefing/schedule) 오분류 즉시 실행|intent/route.ts:92|클라 경량 컨펌|
|low/S|면책 회피 정규식 너무 느슨|ask/route.ts:104|표준 어구로 좁히거나 항상 부착|
|low/S|ensureDisclaimer/withSources 4곳 복붙|ask/proactive/briefing|finz.ts 단일 정의로 공용화|
|low/M|intent system 프롬프트 길고 매 멘션 전송|intent/route.ts:92|컨텍스트 N턴 제한 + 키워드 prefilter|
|nit/S|포트폴리오 카드 경로엔 면책 불변식 미적용|portfolio/handle:146|카드 payload 에 면책 항상|

### 보안·프라이버시 (점수 6)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/S|방 읽기 멤버 가드 전무(포트폴리오·대화 노출)|party/[groupId]/route.ts:9, chat/route.ts:10|GET 에 members-guard 복사|
|H/M|6자리 ID 무인증·무레이트리밋 GET = 열거|finz-group-store.ts:23, party/chat GET|읽기 가드 + 레이트리밋, ID 길이 상향|
|M/M|방 안 멤버 간 신원 위조(impersonation)|finz-chat-store.ts:104, chat:27|쓰기에 세션=memberId 강제(group 우선)|
|M/M|쓰기 라우트 세션 대신 claimed memberId|portfolio/recurring route|requireRoomMember 공통 헬퍼|
|M/M|오픈조인 = 링크 유출 시 비초대자 입장|rooms/[groupId]/join:16|1on1/self 오픈조인 차단, 만료 토큰|
|low/S|cron Bearer 비교 timing-safe 아님|cron/briefing:30|crypto.timingSafeEqual|
|low/S|브리핑 푸시가 방 음소거 무시|cron/briefing:119|message 와 동일 mute 필터|

### 성능·확장성 (점수 6)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/M|매 폴링 전체창(최대 400) LRANGE(델타 없음)|finz-chat-store.ts:295, chat:23|afterSeq 델타 읽기 + LLEN 무변화 조기반환|
|H/M|전송 1건 = 도쿄 Redis 6~7 직렬 왕복|finz-chat-store.ts:60,104|pipeline 묶기, llen→rpush 반환값|
|M/M|타임라인 비메모 → 폴링마다 전체 재렌더|finz-chat-timeline.tsx:147|React.memo + mentionNames useMemo|
|M/S|비멘션마다 proactive → 매번 전체창 읽기|party-room:241, proactive:41|쿨다운 락 먼저 체크|
|M/S|방 열린 동안 60초 recurring tick 상시|party-room:172, recurring/tick:25|정기 등록 있을 때만 tick|
|low/S|방 목록 조회 N×2 Redis(상한 없음)|finz-room.ts:51, group-store:337|zrange 최근 50 상한|
|low/S|LLM 직렬 120s + ask-lock 130s 방 점유|llm.ts:65,89, chat-store:385|AbortController 총예산 + timeout 단축|
|low/M|차트 버블이 위젯마다 외부 스크립트 로드|finz-chart-bubble.tsx:12|IntersectionObserver 지연로드|

### 코드 품질·테스트 (점수 7)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/L|라우트/통합 테스트 0(오케스트레이션 3164줄)|app/api/finz/**/route.ts|결정 로직 순수함수 추출+테스트(portfolio·pick부터)|
|M/M|레거시 memberId 체인 죽은 채 공존|finz-party-create/join-view/taste-selector/party-id|한 PR로 삭제(데모 후)|
|M/M|라우트 보일러플레이트 중복(가드·응답 셰이프)|party/[groupId]/*/route.ts|withFinzMember 헬퍼 + 응답 타입 공유|
|M/M|party-room 629줄, 11개 near-dup fetch 핸들러|finz-party-room.tsx:327|postAction 디스패처/훅|
|low/S|group/room/party 3중 네이밍|group-store vs finz-room vs party/*|용어 사전 문서, 신규는 room|
|low/S|finz-store(email-PK)↔account-store 이원화|finz-store.ts, profile/route.ts|경계 주석, 통합은 별도 계획|
|low/S|정원 상수 클라/서버 중복(ROOM_CAPACITY vs MAX_ROOM_MEMBERS)|party-room:27, group-store|lib/common 단일 정의 공유|

### 제품 전략·응집성 (점수 6)
| | 발견 | 위치 | 권고 |
|---|---|---|---|
|H/M|8개 intent 기능 과잉 → thesis 희석|finz-chat.ts:142, intent:92|우정주 루프 1급, 나머지 실험 강등|
|H/M|첫 가치(우정주)가 3중 게이트 뒤|finz-chats-client.tsx:16, friends:92|self/캐릭터 없이 '미리보기' 허용|
|M/M|피드 broadcast-only(상호작용 훅 없음)|(tabs)/feed/page.tsx:8|'나도 이 테마로 얘기하기' 원탭|
|M/L|포트폴리오가 "대화 not 매매"와 충돌|finz-room-settings.tsx:327|'함께 본 종목' 재프레이밍 or 실험 플래그|
|low/S|콜드스타트 빈 화면 + 친구·대화 동선 중복|finz-chats-client.tsx:72|empty 에서 바로 친구추가 CTA|
|low/S|schedule/briefing = 리마인더 봇 정체성|finz-room-settings.tsx:251, intent:101|투자 맥락으로 좁히기|
|low/M|self 에서 우정주 비활성 → 솔로 도그푸딩 얕음|DESIGN.md:82|self 미리보기 1회 허용|
|low/M|레이드·챌린지 미구현 훅 잔존|finz-account.ts:87|게임화 1개만 검증 or 백로그 명시|

---

## 방법론 노트

- 분석 86개 에이전트(관점 10 → 발견별 검증), 약 430만 토큰. 종합 단계는 세션 한도로 에이전트 실패 → 저장된 검증 결과로 사람이 직접 종합.
- 검증: 각 발견을 인용 위치의 실제 코드와 대조, 근거 없으면 기본 거부. 75건 중 1건 거부(74 통과). `confirmed` vs `partly`(영향/심각도 일부 보정)로 표기됐으며 위 표는 보정 심각도 반영.
- 한계: ① 프론트엔드 아키텍처 관점은 분석 에이전트의 요약 출력이 불완전(발견 7건은 검증 통과). ② 라이브 인증 플로우의 end-to-end 동작은 분석 범위 밖(코드 정적 분석 기준). ③ 권고는 데모 단계 가정 — 사용자 규모가 커지면 perf/보안 항목의 우선순위가 올라간다.
