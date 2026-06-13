# FINZ MVP 1 실행 계획

> 2026-05-09 우정주 MVP 1 기획과 2026-05-10 FINZ 네이밍 회의 이후, 구현 전 제품 범위와 작업 단위를 확정하기 위한 계획 문서.

> ⚠️ **갱신 (2026-06-13) — 이 문서는 현재 구현된 코드와 갈라져 있다. 현행 기준은 [`2026-06-13-finz-mvp2-social-loop-plan.md`](2026-06-13-finz-mvp2-social-loop-plan.md).**
> 이 기획은 *파티 기반·무로그인·localStorage·3화면(`/finz`·`/group`·`/raid`)·`/api/finz/facilitator`*를 전제하지만, 실제 배포본은 **1인(솔로) 흐름 + Google 로그인 필수 + Neon Postgres + `/finz` 단일 화면**으로 구현됐다 (06-06 개발환경 회의에서 파티가 빠지고 로그인+DB가 들어온 피벗). 아래 본문은 *원래 의도한 기획*이며, 현재 코드 상태나 다음 작업 방향과 다를 수 있으니 새 plan을 우선 참조할 것.

## 현재 합의

FINZ(핀즈)는 친구들과 투자 이야기를 가볍게 시작하게 만드는 게임형 대화 앱이다. 목표는 실제 매매 추천이나 수익률 경쟁이 아니라, 서로의 투자 취향을 캐릭터처럼 이해하고 오늘의 우정주를 중심으로 대화가 생기는지 검증하는 것이다.

MVP 1의 핵심 흐름은 다음 4단계다. 2026-05-31 범위 재정의: **AI가 파티 기반 "오늘의 우정주"를 뽑고, 그 우정주를 두고 대화가 이어지도록 질문/소재를 던지는 것까지를 완전한 V0 MVP로 본다.**

1. 취향 카드 선택
2. 개인 투자 캐릭터 소환
3. 친구 그룹 생성 또는 초대
4. AI가 그룹 조합 기반으로 오늘의 우정주와 대화 진행 질문 제안

## MVP 1 제품 원칙

- 첫 경험은 증권 앱이 아니라 게임 프로필 생성에 가까워야 한다.
- "사세요"가 아니라 "얘기해보세요"가 중심 문장이다.
- 종목 정보의 정답성보다 그룹 대화 가능성을 우선한다.
- 사용자가 금융 지식 부족으로 멈추지 않게 추상 카드와 캐릭터 언어를 먼저 쓴다.
- 실제 돈, 실제 자산, 수익률 인증, 복잡한 차트는 MVP 1에서 다루지 않는다.

## 첫 릴리스 범위

### 1. FINZ 시작 화면

사용자는 FINZ의 목적을 한눈에 이해하고 바로 취향 카드를 고른다.

필요 요소:

- FINZ/핀즈 이름 노출
- "친구들과 오늘 이야기할 우정주를 찾는다"는 톤의 짧은 설명
- 취향 카드 선택 영역
- 선택 완료 후 캐릭터 소환 CTA

제외:

- 긴 랜딩 페이지
- 투자 성과나 수익률 중심 카피
- 회원가입 선행

### 2. 취향 카드 선택

사용자는 주식 지식 없이 고를 수 있는 카드 중 3개 이상을 선택한다.

초기 카드 후보:

- 세상을 바꾸는 기술이 좋다
- 오래 버틸 수 있는 회사가 좋다
- 내가 직접 쓰는 브랜드가 좋다
- 한 방이 있어야 재밌다
- 현금흐름이 마음을 편하게 한다
- 사람들이 떠드는 곳에 기회가 있다
- 위기 때 줍는 게 좋다
- 남들이 놓친 저평가를 찾고 싶다
- 숫자보다 스토리에 끌린다
- 유행이 되기 전 먼저 발견하고 싶다
- 매일 쓰는 서비스가 결국 이긴다고 믿는다
- CEO나 창업자 이야기에 끌린다
- 배당처럼 꾸준히 들어오는 게 좋다
- 모두가 무서워할 때 오히려 궁금해진다
- 신제품 발표와 컨퍼런스를 챙겨본다
- 친구들이 쓰기 시작한 앱이 신경 쓰인다
- 적자여도 성장하면 봐줄 수 있다
- 재무제표가 단단한 회사를 좋아한다
- 밈이 붙은 종목은 일단 관찰한다
- 너무 유명해지면 늦었다고 느낀다

구현 메모:

- 카드 선택은 로컬 상태만으로 시작한다.
- 카드별 태그를 둔다. 예: `technology`, `quality`, `brand`, `momentum`, `cashflow`, `contrarian`, `value`, `story`, `early`, `dividend`, `meme`.
- AI 없이도 fallback 캐릭터를 만들 수 있게 카드-캐릭터 매핑을 둔다.

### 3. 개인 투자 캐릭터 소환

카드 선택 결과를 기반으로 개인 캐릭터를 생성한다. MVP 1에서는 AI 생성이 실패해도 deterministic fallback으로 결과를 보여준다.

초기 캐릭터 8종:

| 캐릭터 | 설명 | 강점 | 약점 |
|---|---|---|---|
| 미래기술 딜러 | 세상을 바꿀 기술과 성장 스토리에 먼저 반응한다. | 성장 상상력 | FOMO 위험 |
| 배당 힐러 | 꾸준한 현금흐름과 안정감을 중시한다. | 방어와 회복 | 재미 부족 |
| 가치 탱커 | 가격, 체력, 버틸 힘을 따진다. | 하락장 생존 | 기회비용 |
| 브랜드 레인저 | 사람들이 실제로 쓰고 좋아하는 브랜드를 관찰한다. | 소비자 감각 | 숫자 검증 부족 |
| 밈 버서커 | 시장의 열기와 커뮤니티 에너지를 빠르게 감지한다. | 분위기 포착 | 과열 추격 |
| 매크로 마법사 | 금리, 환율, 경기 흐름을 읽으려 한다. | 큰 흐름 이해 | 개별 기업 감각 부족 |
| 위기 줍줍러 | 모두가 피할 때 반대로 살펴본다. | 역발상 | 타이밍 리스크 |
| 스토리 정찰병 | 숫자보다 서사, 창업자, 제품 방향에 끌린다. | 초기 발견 | 검증 지연 |

캐릭터 결과 포맷:

- 클래스명
- Lv.1 타이틀
- 한 줄 설명
- 스탯: 공격력, 방어력, 인내력, 정보탐색력, FOMO 위험
- 약점
- 친구에게 공유하고 싶은 한 줄 놀림

### 4. 친구 그룹

MVP 1의 그룹은 계정/실시간 초대 없이도 검증 가능해야 한다.

권장 v0 구현:

- 사용자가 그룹 이름을 만든다.
- 본인 캐릭터를 파티에 추가한다.
- 친구 캐릭터는 초대 링크가 아니라 "친구 추가" 임시 입력으로 먼저 테스트한다.
- 각 친구는 이름과 캐릭터를 선택하거나, 같은 카드 선택 플로우로 생성한다.
- 그룹 데이터는 localStorage에 저장한다.

이유:

- 로그인과 공유 인프라를 먼저 만들면 MVP 검증보다 계정/권한 문제가 커진다.
- 첫 검증은 한 기기에서 3명 프로필을 만들어도 충분하다.
- 이후 반응이 좋으면 초대 링크와 공유 복원을 붙인다.

### 5. 오늘의 우정주 + AI 진행자

AI가 그룹의 캐릭터 조합과 카드 태그를 바탕으로 오늘 이야기하면 재밌을 종목 또는 테마 하나를 제안한다. 여기서 AI는 추천하고 끝나는 도구가 아니라, 친구들의 대화에 참여하는 **FINZ 진행자**다. 첫 질문, 반박 소재, 조용한 멤버에게 던질 질문, 대화가 끊겼을 때의 다음 소재까지 같이 만든다.

결과 포맷:

- 오늘의 우정주
- 이 파티가 반응할 이유
- 싸울 포인트
- 찬성 쪽 한 줄
- 반대 쪽 한 줄
- 오늘의 첫 질문 2~3개
- 대화가 끊겼을 때 이어갈 소재 3~5개
- 캐릭터별로 던질 관점
- 투자 주의 문구

원칙:

- 매수/매도 추천처럼 보이는 표현을 피한다.
- 결과에는 "투자 조언이 아니라 대화 소재"라는 문장을 명확히 넣는다.
- 파티 멤버의 캐릭터/스탯/태그를 추천 이유와 질문에 반드시 반영한다.
- AI 실패 시 사용자 친화적 오류를 보여주고, 사전 정의된 예시 종목/테마 fallback은 별도 후속으로 검토한다.

백엔드 V0:

```ts
POST /api/finz/pick
POST /api/finz/facilitator
```

`/api/finz/pick` 은 현재 파티 상태를 받아 Gemini로 `FinzPick` JSON을 생성한다.

```ts
type FinzPick = {
  name: string;
  kind: "stock" | "theme";
  oneLine: string;
  whyThisParty: string[];
  debatePoint: string;
  openingQuestions: string[];
  conversationSeeds: string[];
  rolePrompts: Array<{
    memberName: string;
    role: string;
    prompt: string;
  }>;
  caveats: string[];
};
```

`/api/finz/facilitator` 는 현재 우정주와 대화 목록을 받아 다음 AI 진행 멘트를 생성한다.

```ts
type FinzFacilitatorNext = {
  message: string;
  targetMemberName?: string;
  intent: "question" | "challenge" | "summarize" | "reframe" | "next-topic";
};
```

AI 진행자는 다음 행동 중 하나를 선택한다.

- 아직 말하지 않은 사람에게 캐릭터 역할에 맞는 질문을 던진다.
- 방금 나온 의견에 반대 관점이나 확인할 리스크를 붙인다.
- 지금까지의 대화를 짧게 요약한다.
- 논점이 투자 조언/수익률 경쟁으로 흐르면 "대화 소재" 관점으로 되돌린다.
- 대화가 식으면 같은 우정주 안의 다른 싸울 포인트를 던진다.

Gemini 호출은 기존 `lib/common/llm.ts` 의 `callLlm` 을 재사용한다. 기존 모델 fallback, kill switch, `GEMINI_API_KEY`, `GEMINI_DISABLED`, `PROMPT_VERSION`, quota 기록 패턴을 따른다. `responseSchema` 로 JSON 형식을 강제한다.

### 6. 투자 레이드

우정주 결과를 역할 기반 대화 미션으로 바꾼다.

레이드 구성:

- 보스: 고평가 논란의 엔비디아 같은 한 줄 테마
- 파티 조합: 딜러, 힐러, 탱커 등 캐릭터 요약
- 역할별 미션
- 사용자별 한 줄 포지션
- 파티 요약

포지션 후보:

- 매력 있음
- 관망
- 회의적
- 모르지만 끌림
- 너무 비싸지만 계속 보게 됨
- 친구 말 듣고 다시 봄

MVP 1에서는 자유 채팅보다 한 줄 포지션 입력을 먼저 만든다. 자유 채팅은 나중에 붙여도 되지만, 처음에는 구조화된 입력이 대화 품질을 더 쉽게 검증하게 해준다.

## 최소 데이터 모델

초기에는 DB 없이 localStorage와 API 응답으로 검증한다.

```ts
type FinzTasteCard = {
  id: string;
  label: string;
  tags: string[];
};

type FinzCharacter = {
  classId: string;
  className: string;
  levelTitle: string;
  summary: string;
  stats: {
    attack: number;
    defense: number;
    patience: number;
    research: number;
    fomoRisk: number;
  };
  weakness: string;
  tease: string;
};

type FinzMember = {
  id: string;
  name: string;
  selectedCardIds: string[];
  character: FinzCharacter;
};

type FinzGroup = {
  id: string;
  name: string;
  members: FinzMember[];
  createdAt: string;
};

type FriendshipStockRaid = {
  id: string;
  stockName: string;
  stockSymbol?: string;
  partyReason: string;
  debatePoint: string;
  proLine: string;
  conLine: string;
  question: string;
  missions: {
    memberId: string;
    prompt: string;
  }[];
  positions: {
    memberId: string;
    stance: string;
    note: string;
  }[];
  summary?: string;
  disclaimer: string;
};
```

## 최소 화면 목록

1. `/finz`
   - 취향 카드 선택
   - 캐릭터 소환
   - 그룹 생성 진입

2. `/finz/group`
   - 그룹 이름
   - 멤버/캐릭터 파티 표시
   - 친구 임시 추가
   - 오늘의 우정주 생성

3. `/finz/raid`
   - 오늘의 우정주 결과
   - 역할별 미션
   - 한 줄 포지션 입력
   - 파티 요약

초기 구현은 App Router 안에 `app/(site)/finz`를 추가하고, FINZ 전용 로직은 `lib/common/services/finz.ts`에서 시작한다.

## LLM 사용 계획

MVP 1에서는 AI 호출 지점을 두 군데로 제한한다.

1. 캐릭터 결과 문장 다듬기
2. 그룹 기반 오늘의 우정주/레이드 생성

캐릭터 분류 자체는 deterministic mapping으로 시작한다. AI는 결과를 더 재미있게 표현하는 보조 역할로 둔다. 이렇게 하면 quota나 모델 장애가 있어도 첫 경험이 끊기지 않는다.

## 안전 문구

FINZ 화면과 AI 결과에는 다음 의미를 반복해서 둔다.

> FINZ는 투자 조언이나 매매 추천을 제공하지 않습니다. 친구들과 이야기할 대화 소재를 만드는 실험입니다.

너무 무겁게 보이지 않도록 UI에서는 짧게 쓰고, 결과 하단에 상세 문구를 둔다.

## 구현 순서

1. `FINZ-MVP-01`: `/finz` 시작 화면과 취향 카드 선택
2. `FINZ-MVP-02`: 카드 기반 캐릭터 소환과 결과 UI
3. `FINZ-MVP-03`: localStorage 기반 그룹/파티 구성
4. `FINZ-MVP-04`: 우정주/레이드 생성 API와 fallback
5. `FINZ-MVP-05`: 한 줄 포지션 입력과 파티 요약
6. `FINZ-MVP-06`: 첫 dogfooding 체크리스트와 피드백 수집

## 검증 방법

첫 dogfooding은 친구 3명 기준으로 진행한다.

체크할 질문:

- 취향 카드를 3개 고르는 데 막힘이 없는가?
- 캐릭터 결과를 보고 웃거나 공유하고 싶은가?
- 그룹 조합을 보고 "우리답다"는 반응이 나오는가?
- 오늘의 우정주가 매수 추천이 아니라 대화 소재처럼 느껴지는가?
- 한 줄 포지션을 남기고 싶어지는가?
- 다음 레이드도 해보고 싶다는 반응이 있는가?

성공 기준:

- 3명 모두 캐릭터 결과를 끝까지 본다.
- 최소 2명이 캐릭터 결과를 친구에게 읽어준다.
- 그룹 레이드에서 3명 중 2명 이상이 한 줄 포지션을 남긴다.
- 테스트 후 "다음 주제도 해보자"는 반응이 1명 이상 나온다.

## 의도적으로 미루는 것

- 로그인
- 실제 친구 초대 링크
- 실제 자산 입력
- 실시간 주가 차트
- 고급 가격 API
- 공동 모의투자 정산
- 수익률 랭킹
- 예측 카드
- 투표

초대 링크, 투표, 예측 카드는 MVP 1 dogfooding 이후에 붙인다. 자연스러운 확장 순서는 투표, 예측 카드, 공동 모의투자다.

## 미결정 질문

- 첫 dogfooding에서 실제 종목을 쓸지, 테마/섹터부터 시작할지
- 캐릭터 톤을 얼마나 게임스럽게 둘지
- AI 결과에 특정 종목을 넣을 때 외부 최신 정보 조회를 필수로 할지
- FINZ를 secondwind의 세 번째 실험으로 둘지, 기존 `experiment-3` placeholder를 대체할지

## 추천 결정

다음 개발 작업은 `FINZ-MVP-01`부터 시작한다. 단, 실제 구현 전에 `experiment-3` placeholder를 FINZ로 대체할지, `/finz`를 별도 경로로 바로 열지 한 번만 결정한다. 현재 추천은 `/finz` 별도 경로를 만들고, 홈 카드에서 "FINZ"를 세 번째 서비스로 노출하는 방식이다.
