// 서버 전용: FINZ 채팅 타임라인을 Upstash Redis LIST 로 7일 TTL 보관한다.
// sw:finz:chat:<id> = append-only LIST. append = 단일 원자적 rpush(절대 rpush+lset 2단계 금지 —
// 그 사이 동시 append/LTRIM 이 끼면 lset 이 엉뚱한 원소를 덮는 레이스). seq 는 저장하지 않고
// 읽기 시점 LIST 인덱스(LLEN 기반 오프셋 + 배열 인덱스)로 부여 — 단일 쓰기로 충분, 더 단순·견고.
// (만약 나중에 LTRIM 을 도입하면 인덱스=seq 가 깨지므로, rpush 전에 redis.incr(seqKey) 로 seq 를
//  먼저 받아 메시지에 박는 방식으로 바꿀 것. v1 은 LTRIM 안 함.)
//
// 식별: memberId 는 위조 가능한 클라이언트 값(2인 신뢰 파티 기준 수용). 단, 멤버 발신 append 는
// authorName 을 그룹 멤버에서 서버 조회하고, role/authorId 를 finz/system 으로 위조하는 건 하드 거절한다.

import {
  FINZ_GROUP_TTL_SECONDS,
  MAX_NOTE_LENGTH,
  getClient,
  getFinzGroup,
  groupKey,
  parseJsonSafe,
} from "./finz-group-store";
import {
  isFinzStoredChatMessage,
  type FinzChatMessage,
  type FinzStoredChatMessage,
} from "@/lib/common/services/finz-chat";
import type { FinzPartyPick, FinzPartyStance, FinzPartySummary } from "@/lib/common/services/finz";

export const MAX_TEXT_LENGTH = 280;
export const TEXT_RATE_LIMIT_MS = 800;
const HARD_CEILING = 400; // 이 이상이면 새 메시지 거부(+ 1회 안내)
// 읽기 창 = 하드 실링과 동일. 리스트가 HARD_CEILING 을 넘지 못하므로 항상 전체(seq 0..end)를 읽는다.
// selectLatestPick / 포지션 / 요약 같은 결정 로직이 부분 뷰에서 돌면 잘못된 nudge·LLM 중복 호출이 나기 때문.
// (만약 나중에 LTRIM 으로 리스트를 더 줄이면 인덱스=seq 가 깨지니, 그땐 incr 기반 seq 로 전환할 것.)
const INITIAL_WINDOW = HARD_CEILING;
const PICK_LOCK_TTL_SECONDS = 45;
const SUMMARY_LOCK_TTL_SECONDS = 30;

function chatKey(id: string): string {
  return `sw:finz:chat:${id}`;
}
function pickLockKey(id: string): string {
  return `${chatKey(id)}:pick-lock`;
}
function summaryLockKey(id: string): string {
  return `${chatKey(id)}:summary-lock`;
}
function rerollLockKey(id: string): string {
  return `${chatKey(id)}:reroll-lock`;
}
function askLockKey(id: string): string {
  return `${chatKey(id)}:ask-lock`;
}

function newId(): string {
  return crypto.randomUUID();
}

// 단일 원자적 append + 양쪽 키 TTL 갱신. seq 는 박지 않는다(읽기 시점 부여).
// 그룹이 없거나 KV 미설정이면 not-found(시스템/시드 append 는 best-effort 라 호출부가 무시).
async function appendChatMessage(
  id: string,
  stored: FinzStoredChatMessage,
): Promise<{ status: "ok" | "not-found"; message?: FinzStoredChatMessage }> {
  const redis = getClient();
  if (!redis) return { status: "not-found" };
  const group = await getFinzGroup(id);
  if (!group) return { status: "not-found" };

  const len = await redis.llen(chatKey(id));
  if (len >= HARD_CEILING) {
    // 정확히 한 번만 안내 — 그 다음부터는 조용히 드롭.
    if (len === HARD_CEILING) {
      const notice: FinzStoredChatMessage = {
        id: newId(),
        role: "system",
        authorId: "system",
        authorName: "",
        kind: "system",
        text: "대화가 너무 길어졌어요. 새 파티를 만들어 이어가 볼까요?",
        createdAt: new Date().toISOString(),
      };
      await redis.rpush(chatKey(id), JSON.stringify(notice));
      await refreshTtls(id);
    }
    return { status: "ok" };
  }

  await redis.rpush(chatKey(id), JSON.stringify(stored));
  await refreshTtls(id);
  return { status: "ok", message: stored };
}

async function refreshTtls(id: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  // 두 TTL 을 한 파이프라인으로 — 신원 키가 채팅보다 먼저 만료돼 orphan 404 나는 걸 막는다.
  await redis.pipeline().expire(chatKey(id), FINZ_GROUP_TTL_SECONDS).expire(groupKey(id), FINZ_GROUP_TTL_SECONDS).exec();
}

// 멤버 자유 텍스트. LLM 절대 안 거침. members-guard + 서버 authorName + 길이/레이트 제한.
// clientId(클라이언트 tempId)를 메시지 id 로 쓴다 — 응답 유실 후 재시도해도 같은 id 라 dedup 으로 합쳐진다.
export async function appendTextMessage(
  id: string,
  memberId: string,
  text: string,
  clientId?: string,
): Promise<{ status: "ok" | "not-found" | "not-member" | "rate-limited" | "empty"; message?: FinzStoredChatMessage }> {
  // role/authorId 를 봇/시스템으로 위조하는 것은 하드 거절(멤버는 finz/system 가 될 수 없다).
  if (memberId === "finz" || memberId === "system") return { status: "not-member" };
  const group = await getFinzGroup(id);
  if (!group) return { status: "not-found" };
  const member = group.members.find((m) => m.memberId === memberId);
  if (!member) return { status: "not-member" };

  const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
  if (trimmed.length === 0) return { status: "empty" };

  const recent = await readWindow(id, 24);

  // 멱등: 같은 clientId 가 이미 있으면(응답 유실 후 재시도) 다시 쓰지 않고 기존 것을 돌려준다.
  if (clientId && clientId.length > 0) {
    const dup = recent.find((m) => m.id === clientId);
    if (dup) return { status: "ok", message: dup };
  }

  // 레이트 리밋: 이 멤버의 마지막 텍스트가 너무 최근이면 거절(꼬리 일부만 확인).
  const myLastText = [...recent].reverse().find((m) => m.kind === "text" && m.authorId === memberId);
  if (myLastText) {
    const last = Date.parse(myLastText.createdAt);
    if (Number.isFinite(last) && Date.now() - last < TEXT_RATE_LIMIT_MS) {
      return { status: "rate-limited" };
    }
  }

  const stored: FinzStoredChatMessage = {
    id: clientId && clientId.length > 0 ? clientId : newId(),
    role: "member",
    authorId: memberId,
    authorName: member.displayName,
    kind: "text",
    text: trimmed,
    createdAt: new Date().toISOString(),
  };
  return appendChatMessage(id, stored);
}

// 멤버 한 줄 포지션. 매번 새 메시지(upsert 안 함 — 입장 바꾼 이력이 채팅에 남는다).
export async function appendPositionMessage(
  id: string,
  memberId: string,
  stance: FinzPartyStance,
  note: string,
): Promise<{ status: "ok" | "not-found" | "not-member"; message?: FinzStoredChatMessage }> {
  if (memberId === "finz" || memberId === "system") return { status: "not-member" };
  const group = await getFinzGroup(id);
  if (!group) return { status: "not-found" };
  const member = group.members.find((m) => m.memberId === memberId);
  if (!member) return { status: "not-member" };

  const stored: FinzStoredChatMessage = {
    id: newId(),
    role: "member",
    authorId: memberId,
    authorName: member.displayName,
    kind: "position",
    payload: { stance, note: note.trim().slice(0, MAX_NOTE_LENGTH) },
    createdAt: new Date().toISOString(),
  };
  return appendChatMessage(id, stored);
}

// 서버 소유 append — 봇/시스템 전용. 호출부가 best-effort(try/catch)로 감싼다.
export async function appendSystemMessage(id: string, text: string): Promise<void> {
  const stored: FinzStoredChatMessage = {
    id: newId(),
    role: "system",
    authorId: "system",
    authorName: "",
    kind: "system",
    text,
    createdAt: new Date().toISOString(),
  };
  await appendChatMessage(id, stored);
}

export async function appendPickMessage(
  id: string,
  pick: FinzPartyPick,
): Promise<{ status: "ok" | "not-found"; message?: FinzStoredChatMessage }> {
  const stored: FinzStoredChatMessage = {
    id: newId(),
    role: "finz",
    authorId: "finz",
    authorName: "FINZ",
    kind: "pick",
    payload: pick,
    createdAt: new Date().toISOString(),
  };
  return appendChatMessage(id, stored);
}

export async function appendSummaryMessage(
  id: string,
  summary: FinzPartySummary,
): Promise<{ status: "ok" | "not-found"; message?: FinzStoredChatMessage }> {
  const stored: FinzStoredChatMessage = {
    id: newId(),
    role: "finz",
    authorId: "finz",
    authorName: "FINZ",
    kind: "summary",
    payload: summary,
    createdAt: new Date().toISOString(),
  };
  return appendChatMessage(id, stored);
}

// @finz 질문에 대한 답변 — finz 의 자유 텍스트 메시지.
export async function appendAnswerMessage(
  id: string,
  text: string,
): Promise<{ status: "ok" | "not-found"; message?: FinzStoredChatMessage }> {
  const stored: FinzStoredChatMessage = {
    id: newId(),
    role: "finz",
    authorId: "finz",
    authorName: "FINZ",
    kind: "text",
    text,
    createdAt: new Date().toISOString(),
  };
  return appendChatMessage(id, stored);
}

// 내부: 꼬리 N개를 파싱된 FinzChatMessage(seq 포함)로. 레이트 리밋/요약 조회용.
async function readWindow(id: string, count: number): Promise<FinzChatMessage[]> {
  const redis = getClient();
  if (!redis) return [];
  const total = await redis.llen(chatKey(id));
  if (total === 0) return [];
  const start = Math.max(0, total - count);
  const raw = await redis.lrange(chatKey(id), start, -1);
  return hydrate(raw, start);
}

// lrange 원소(객체 또는 문자열) → 검증 → seq=절대인덱스 부여.
function hydrate(raw: unknown[], windowStart: number): FinzChatMessage[] {
  const out: FinzChatMessage[] = [];
  raw.forEach((el, i) => {
    const obj = parseJsonSafe(el);
    if (!obj || !isFinzStoredChatMessage(obj)) return;
    out.push({ ...obj, seq: windowStart + i } as FinzChatMessage);
  });
  return out;
}

// 폴링/SSR 진입점: afterSeq 초과 메시지만(오름차순) + cursor(최대 seq) + total.
export async function getChatTail(
  id: string,
  afterSeq: number,
): Promise<{ messages: FinzChatMessage[]; cursor: number; total: number }> {
  const redis = getClient();
  if (!redis) return { messages: [], cursor: afterSeq, total: 0 };
  const total = await redis.llen(chatKey(id));
  if (total === 0) return { messages: [], cursor: afterSeq < 0 ? -1 : afterSeq, total: 0 };

  const windowStart = Math.max(0, total - INITIAL_WINDOW);
  const raw = await redis.lrange(chatKey(id), windowStart, -1);
  const all = hydrate(raw, windowStart);
  const messages = all.filter((m) => m.seq > afterSeq);
  return { messages, cursor: total - 1, total };
}

// 픽/요약 LLM 동시·중복 호출 방지 — 진짜 원자적 락(SET NX). 실패하면 호출부가 기존 결과를 반환.
// force(재추첨)는 del-then-set 이 아니라, 짧은 reroll-lock(NX)으로 동시 재추첨을 하나로 합류시킨다
// (del-then-set 은 두 force 가 끼어들면 한쪽이 상대의 갓 잡은 락을 지워 둘 다 통과하는 레이스).
export async function acquirePickLock(id: string, force: boolean): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true;
  if (force) {
    const reroll = await redis.set(rerollLockKey(id), "1", { nx: true, ex: 8 });
    if (reroll !== "OK") return false; // 진 force 호출 → 라우트가 기존 픽을 deduped 로 반환
    await redis.del(pickLockKey(id));
  }
  const res = await redis.set(pickLockKey(id), "1", { nx: true, ex: PICK_LOCK_TTL_SECONDS });
  return res === "OK";
}

// append 가 실패(그룹 소멸·실링)하면 락을 풀어 다음 시도가 바로 가능하게.
export async function releasePickLock(id: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(pickLockKey(id));
}

export async function acquireSummaryLock(id: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true;
  const res = await redis.set(summaryLockKey(id), "1", { nx: true, ex: SUMMARY_LOCK_TTL_SECONDS });
  return res === "OK";
}

export async function releaseSummaryLock(id: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(summaryLockKey(id));
}

// @finz 동시 중복 호출(=동시 그라운딩 LLM 비용) 방지용 "동시성 락". 쿨다운이 아니다 —
// 답이 끝나면 finally 에서 풀어 다음 @finz 가 곧바로 답을 받게 한다("반드시 대답" 요구 충족).
// TTL 은 호출 최악 시간(per-attempt 60s × 2모델 fallback)을 덮어 진행 중 만료로 동시성 구멍이
// 생기지 않게 크게 잡는다(서버 크래시 시 자동 해제용 안전망). 진행 중인 한 명만 LLM 을 쓴다.
export async function acquireAskLock(id: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true;
  const res = await redis.set(askLockKey(id), "1", { nx: true, ex: 130 });
  return res === "OK";
}

export async function releaseAskLock(id: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(askLockKey(id));
}
