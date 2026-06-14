// FINZ 채팅 모델 — 클라이언트/서버 공용(순수). 카카오톡식 단일 타임라인이 곧 상태다.
// 자유 텍스트·우정주 픽·멤버 포지션·AI 요약·시스템 알림이 모두 "메시지"로 append-only 로 쌓인다.
// "저장" 개념 없음 — append 가 유일한 변경 연산. seq 는 KV LIST 인덱스(읽기 시점 부여, 저장 안 함).
//
// nudge('이제 뭐 할지') 는 메시지가 아니다 — 현재 상태에서 클라이언트가 매 렌더 계산하는
// 비저장 코칭 버블이다(중복 저장·스팸 방지). computeNextNudge 참조.

import {
  FINZ_PARTY_STANCES,
  isFinzPartyPick,
  isFinzPartySummary,
  type FinzPartyPick,
  type FinzPartyStance,
  type FinzPartySummary,
} from "./finz";

export type FinzChatRole = "member" | "finz" | "system";
export type FinzChatKind = "text" | "system" | "pick" | "position" | "summary";

export type FinzPositionPayload = { stance: FinzPartyStance; note: string };

// kind 별 페이로드/필수 필드를 base 제네릭으로 분기 — stored(저장형, seq 없음)와 message(읽기형, seq 있음)를
// 같은 모양으로 한 번에 정의한다.
type FinzChatVariants<B> =
  | (B & { kind: "text"; text: string })
  | (B & { kind: "system"; text: string })
  | (B & { kind: "pick"; payload: FinzPartyPick })
  | (B & { kind: "position"; payload: FinzPositionPayload })
  | (B & { kind: "summary"; payload: FinzPartySummary });

type FinzStoredBase = {
  id: string; // crypto.randomUUID() — React key + 낙관적 전송 reconcile 의 유일 키
  role: FinzChatRole;
  authorId: string; // memberId, 또는 리터럴 "finz" / "system"
  authorName: string; // member.displayName(서버 조회), 또는 "FINZ" / ""
  createdAt: string; // ISO
};

// KV LIST 에 JSON.stringify 되는 값 — seq 없음(읽기 시점 인덱스로 부여).
export type FinzStoredChatMessage = FinzChatVariants<FinzStoredBase>;
// 클라이언트/라우트가 다루는 값 — seq(절대 인덱스) 포함.
export type FinzChatMessage = FinzChatVariants<FinzStoredBase & { seq: number }>;

export type FinzChatPickMessage = Extract<FinzChatMessage, { kind: "pick" }>;
export type FinzChatPositionMessage = Extract<FinzChatMessage, { kind: "position" }>;
export type FinzChatSummaryMessage = Extract<FinzChatMessage, { kind: "summary" }>;

export type FinzChatMemberLite = {
  memberId: string;
  displayName: string;
  selectedCardIds: string[];
  joinedAt: string;
};

// nudge(코칭) — 클라이언트 전용, KV 에 절대 직렬화하지 않는다.
export type FinzNudgeCta = "invite" | "pick" | "position" | "summary";
export type FinzNudge = { cta: FinzNudgeCta; text: string; missingMemberName?: string };

export type FinzChatResponse = {
  status: "ok" | "not-found" | "error";
  members?: FinzChatMemberLite[];
  full?: boolean;
  messages?: FinzChatMessage[];
  cursor?: number; // 응답에 담긴 최대 seq — 클라이언트는 로컬 cursor 를 이 값으로 전진
  expiresAt?: string;
  deduped?: boolean; // pick/summary 라우트 전용 — 락에 막혀 기존 결과를 반환했음
  nudged?: boolean; // summary 라우트 전용 — 선행 조건 미충족(에러 대신 클라이언트 nudge 유도)
};

function isPositionPayload(value: unknown): value is FinzPositionPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<FinzPositionPayload>;
  return (
    typeof p.stance === "string" &&
    (FINZ_PARTY_STANCES as readonly string[]).includes(p.stance) &&
    typeof p.note === "string"
  );
}

// KV 에서 읽은 값은 신뢰하지 않는다 — 기존 isFinz* 의 관용 검증 패턴을 그대로 따른다.
// 모르는 kind / 페이로드 깨짐은 드롭(해당 메시지만), 타임라인 전체는 유지.
export function isFinzStoredChatMessage(value: unknown): value is FinzStoredChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id.length === 0) return false;
  if (m.role !== "member" && m.role !== "finz" && m.role !== "system") return false;
  if (typeof m.authorId !== "string" || m.authorId.length === 0) return false;
  if (typeof m.authorName !== "string") return false;
  if (typeof m.createdAt !== "string") return false;
  switch (m.kind) {
    case "text":
    case "system":
      return typeof m.text === "string";
    case "pick":
      return isFinzPartyPick(m.payload);
    case "summary":
      return isFinzPartySummary(m.payload);
    case "position":
      return isPositionPayload(m.payload);
    default:
      return false;
  }
}

export function isFinzNudgeCta(value: unknown): value is FinzNudgeCta {
  return value === "invite" || value === "pick" || value === "position" || value === "summary";
}

// 메시지가 finz 를 호출하는지(@finz / @핀즈). 호출 시 그라운딩 LLM 이 질문에 답한다.
export function mentionsFinz(text: string): boolean {
  return /@\s*(finz|핀즈)/i.test(text);
}

// ── 순수 셀렉터(I/O 없음, 단위 테스트 대상). messages 는 seq 오름차순 가정. ──

export function selectLatestPick(messages: FinzChatMessage[]): FinzChatPickMessage | null {
  let latest: FinzChatPickMessage | null = null;
  for (const m of messages) {
    if (m.kind === "pick" && (latest === null || m.seq > latest.seq)) latest = m;
  }
  return latest;
}

export type LatestPosition = { stance: FinzPartyStance; note: string; authorId: string; seq: number };

// 현재 픽(sincePickSeq) 이후의 포지션만, 멤버별 최신 1개. 옛 픽에 남긴 포지션은 제외(재추첨 시 리셋).
export function selectLatestPositionsByMember(
  messages: FinzChatMessage[],
  sincePickSeq: number,
): Map<string, LatestPosition> {
  const byMember = new Map<string, LatestPosition>();
  for (const m of messages) {
    if (m.kind !== "position" || m.seq <= sincePickSeq) continue;
    const prev = byMember.get(m.authorId);
    if (!prev || m.seq > prev.seq) {
      byMember.set(m.authorId, { stance: m.payload.stance, note: m.payload.note, authorId: m.authorId, seq: m.seq });
    }
  }
  return byMember;
}

function maxSummarySeq(messages: FinzChatMessage[], sincePickSeq: number): number {
  let max = -1;
  for (const m of messages) {
    if (m.kind === "summary" && m.seq > sincePickSeq && m.seq > max) max = m.seq;
  }
  return max;
}

// "이제 뭐 할까" 코칭 — 현재 상태에서 단 하나(또는 없음)를 계산. 비저장. 상태가 진행되면 자연히 사라짐.
export function computeNextNudge(
  messages: FinzChatMessage[],
  members: FinzChatMemberLite[],
  myMemberId: string | null,
): FinzNudge | null {
  if (members.length < 2) {
    return { cta: "invite", text: "친구를 초대하면 둘의 조합으로 우정주를 뽑아줄게." };
  }
  const latestPick = selectLatestPick(messages);
  if (!latestPick) {
    return { cta: "pick", text: "둘 다 모였어! 이 조합의 우정주를 뽑아볼까?" };
  }
  const positions = selectLatestPositionsByMember(messages, latestPick.seq);
  const iPositioned = myMemberId != null && positions.has(myMemberId);
  if (!iPositioned) {
    return { cta: "position", text: "이 테마, 너는 어떻게 봐? 한 줄 입장을 남겨봐." };
  }
  const other = members.find((m) => m.memberId !== myMemberId);
  if (other && !positions.has(other.memberId)) {
    return {
      cta: "position",
      missingMemberName: other.displayName,
      text: `${other.displayName}님의 입장을 기다리는 중이야.`,
    };
  }
  // 둘 다 포지션 완료 — 이 픽 기준 최신 요약이 최신 포지션보다 뒤면 더 권할 게 없다.
  const latestPositionSeq = Math.max(...[...positions.values()].map((p) => p.seq), latestPick.seq);
  if (maxSummarySeq(messages, latestPick.seq) > latestPositionSeq) return null;
  return { cta: "summary", text: "둘 다 입장을 남겼어! AI 파티 요약을 받아볼까?" };
}
