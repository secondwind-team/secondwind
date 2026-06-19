// FINZ 메신저 계정 모델 — 클라이언트/서버 공용(순수, I/O 없음).
//
// 핵심: FINZ 는 자체 계정(accountId)·핸들을 소유한다. Google 로그인은 "인증"만 담당하고
// (어떤 사람인지 확인), 실제 계정/핸들/프로필은 FINZ 가 관리한다. 그래서 나중에 Google 외
// 다른 로그인(애플·카카오 등)을 붙여도 같은 accountId 로 귀속시킬 수 있다 (provider-agnostic).
//
// authlink(provider, providerId) → accountId 매핑이 그 연결고리다. 계정 자체엔 이메일 같은
// 개인정보를 두지 않는다 — 공개되는 건 handle/displayName/캐릭터(취향)뿐.

// ── 핸들 규칙 ──
// 3~20자, 소문자 영숫자 + 밑줄. 입력의 앞 @ 와 공백은 제거하고 소문자로 정규화한다.
export const FINZ_HANDLE_MIN = 3;
export const FINZ_HANDLE_MAX = 20;
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const FINZ_DISPLAY_NAME_MAX = 24;
export const FINZ_BIO_MAX = 120;

// 사용자가 입력한 핸들을 정규화: 앞뒤 공백·선행 @ 제거 후 소문자.
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .slice(0, FINZ_HANDLE_MAX);
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

// 표시용 — 항상 @ 를 붙인다.
export function formatHandle(handle: string): string {
  return `@${handle}`;
}

// ── 계정 ──
// 공개 안전한 계정 표현(이메일 등 PII 없음). selectedCardIds 로 캐릭터를 렌더 시 재구성한다
// (기존 group-store 패턴과 동일 — 카탈로그 변경 내성).
export type FinzAccount = {
  accountId: string;
  handle: string; // 정규화된 값(@ 없음)
  displayName: string;
  selectedCardIds: string[];
  bio: string;
  createdAt: string;
  updatedAt: string;
};

// 친구/피드/멤버 목록에 노출하는 가벼운 계정 요약.
export type FinzAccountSummary = {
  accountId: string;
  handle: string;
  displayName: string;
  selectedCardIds: string[];
};

export function toAccountSummary(a: FinzAccount): FinzAccountSummary {
  return {
    accountId: a.accountId,
    handle: a.handle,
    displayName: a.displayName,
    selectedCardIds: a.selectedCardIds,
  };
}

// ── 친구 그래프 ──
export type FinzFriendStatus = "accepted" | "incoming" | "outgoing";

export type FinzFriendEntry = {
  account: FinzAccountSummary;
  status: FinzFriendStatus;
  since: string;
};

export type FinzFriendsView = {
  friends: FinzFriendEntry[]; // accepted
  incoming: FinzFriendEntry[]; // 나에게 온 요청(수락 대기)
  outgoing: FinzFriendEntry[]; // 내가 보낸 요청
};

// ── 피드 ──
// 친구의 활동이 SNS 타임라인처럼 쌓인다. append-only, 친구에게만 노출.
export type FinzFeedType =
  | "account_created" // 핀즈 시작(가입)
  | "character_summoned" // 캐릭터 (재)소환
  | "room_created" // 새 대화방을 열었다
  | "pick_created" // 어떤 방에서 우정주를 만들었다
  | "raid_started" // 레이드를 시작했다
  | "challenge_done"; // 챌린지를 달성했다

export type FinzFeedEvent = {
  id: string;
  actor: FinzAccountSummary;
  type: FinzFeedType;
  // type 별 표시용 필드(전부 선택). LLM·민감정보 없음 — 서버가 채운다.
  title?: string; // 우정주/레이드 테마명, 챌린지명 등
  roomId?: string; // 관련 대화방(있으면 바로가기)
  createdAt: string;
};

export function isFinzFeedType(value: unknown): value is FinzFeedType {
  return (
    value === "account_created" ||
    value === "character_summoned" ||
    value === "room_created" ||
    value === "pick_created" ||
    value === "raid_started" ||
    value === "challenge_done"
  );
}

// ── 대화방 요약(목록용) ──
// self = "나와의 채팅"(혼자, 메모/테스트용 — @AI 도 혼자 테스트 가능).
export type FinzRoomKind = "1on1" | "group" | "self";

export type FinzRoomSummary = {
  roomId: string;
  kind: FinzRoomKind;
  title: string; // 표시명(그룹명 또는 상대 displayName)
  participants: FinzAccountSummary[];
  lastActiveAt: string;
  // 목록 미리보기(있으면). 메시지 본문 일부 — 서버가 마지막 메시지에서 도출.
  preview?: string;
};

// ── 온보딩/계정 응답 상태 ──
// anon: 로그인 안 함 → 로그인 게이트
// needs-onboarding: 로그인했지만 핸들/캐릭터 미설정 → 온보딩
// ok: 계정 준비됨 → 메신저
export type FinzAccountStatus = "anon" | "needs-onboarding" | "ok";

export type FinzAccountResponse = {
  status: FinzAccountStatus;
  account?: FinzAccount;
};
