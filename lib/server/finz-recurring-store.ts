// 서버 전용: 방별 "정기 메시지" 정의를 Upstash Redis 에 보관한다.
//  - sw:finz:recurring:<msgId>            = 정의 JSON(FinzRecurringMessage). TTL 60일, 쓰기마다 갱신.
//  - sw:finz:recurring:room:<roomId>      = 방의 정의 id SET(설정 화면 목록용).
//  - sw:finz:recurring:due                = 전역 ZSET(score=nextRunAt ms, member=msgId). enabled 만 등재.
//                                            cron 이 zrangebyscore(0, now) 로 due 를 읽어 발송.
//  - sw:finz:recurring:<msgId>:lock       = 발송 처리 동시성 락(동시 cron 중복 발송 방지).
//
// 식별: 방 채팅과 동일하게 memberId 신뢰 모델(2인/소그룹 친구 채팅 기준). 라우트가 members-guard.

import {
  computeNextRun,
  isFinzRecurringMessage,
  MAX_RECURRING_PER_ROOM,
  type FinzRecurringMessage,
  type NormalizedRecurring,
} from "@/lib/common/services/finz-recurring";
import { getClient, parseJsonSafe } from "./finz-group-store";

const RECURRING_TTL_SECONDS = 60 * 24 * 60 * 60; // 60일(방 30일보다 길게 — 방 소멸 시 cron 이 정리)
const RUN_LOCK_TTL_SECONDS = 120;

function defKey(id: string): string {
  return `sw:finz:recurring:${id}`;
}
function roomSetKey(roomId: string): string {
  return `sw:finz:recurring:room:${roomId}`;
}
function dueKey(): string {
  return "sw:finz:recurring:due";
}
function runLockKey(id: string): string {
  return `${defKey(id)}:lock`;
}

function newId(): string {
  return crypto.randomUUID();
}

function parseDef(raw: unknown): FinzRecurringMessage | null {
  const obj = parseJsonSafe(raw);
  if (!obj || !isFinzRecurringMessage(obj)) return null;
  return obj;
}

async function persistDef(def: FinzRecurringMessage): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.set(defKey(def.id), JSON.stringify(def), { ex: RECURRING_TTL_SECONDS });
  // due ZSET 동기화: enabled 면 nextRunAt 으로 등재, disabled 면 제거.
  if (def.enabled) await redis.zadd(dueKey(), { score: def.nextRunAt, member: def.id });
  else await redis.zrem(dueKey(), def.id);
}

// 새 정기 메시지 등록. 방당 상한 초과면 "limit"(라우트가 안내). 캐릭터/방 검증은 라우트가 선행.
export async function createRecurring(input: {
  roomId: string;
  createdBy: string;
  normalized: NormalizedRecurring;
  nowMs: number;
}): Promise<{ status: "ok"; def: FinzRecurringMessage } | { status: "limit" } | { status: "error" }> {
  const redis = getClient();
  if (!redis) return { status: "error" };

  const count = await redis.scard(roomSetKey(input.roomId));
  if (count >= MAX_RECURRING_PER_ROOM) return { status: "limit" };

  const n = input.normalized;
  const def: FinzRecurringMessage = {
    id: newId(),
    roomId: input.roomId,
    createdBy: input.createdBy,
    contentKind: n.contentKind,
    content: n.content,
    freq: n.freq,
    hour: n.hour,
    minute: n.minute,
    weekday: n.weekday,
    intervalMinutes: n.intervalMinutes,
    enabled: true,
    createdAt: new Date(input.nowMs).toISOString(),
    nextRunAt: computeNextRun(n, input.nowMs),
    lastRunAt: 0,
  };
  await persistDef(def);
  await redis.sadd(roomSetKey(input.roomId), def.id);
  await redis.expire(roomSetKey(input.roomId), RECURRING_TTL_SECONDS);
  return { status: "ok", def };
}

// 방의 정기 메시지 목록(생성순). 정의가 사라진 id 는 SET 에서 self-heal 제거.
export async function listRecurringForRoom(roomId: string): Promise<FinzRecurringMessage[]> {
  const redis = getClient();
  if (!redis) return [];
  const ids = (await redis.smembers(roomSetKey(roomId))) as string[];
  if (!ids || ids.length === 0) return [];

  const out: FinzRecurringMessage[] = [];
  for (const id of ids) {
    const def = parseDef(await redis.get(defKey(id)));
    if (def) out.push(def);
    else await redis.srem(roomSetKey(roomId), id).catch(() => {}); // 만료/소멸 self-heal
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getRecurring(id: string): Promise<FinzRecurringMessage | null> {
  const redis = getClient();
  if (!redis) return null;
  return parseDef(await redis.get(defKey(id)));
}

// 정의 수정. 스케줄/활성 변경 시 nextRunAt 재계산. roomId mismatch 면 거부(방 가드).
export async function updateRecurring(
  roomId: string,
  id: string,
  patch: Partial<Pick<FinzRecurringMessage, "content" | "contentKind" | "freq" | "hour" | "minute" | "weekday" | "intervalMinutes" | "enabled">>,
  nowMs: number,
): Promise<FinzRecurringMessage | null> {
  const current = await getRecurring(id);
  if (!current || current.roomId !== roomId) return null;

  const scheduleChanged =
    (patch.freq !== undefined && patch.freq !== current.freq) ||
    (patch.hour !== undefined && patch.hour !== current.hour) ||
    (patch.minute !== undefined && patch.minute !== current.minute) ||
    (patch.weekday !== undefined && patch.weekday !== current.weekday) ||
    (patch.intervalMinutes !== undefined && patch.intervalMinutes !== current.intervalMinutes);
  const reEnabled = patch.enabled === true && !current.enabled;

  const next: FinzRecurringMessage = { ...current, ...patch };
  // 스케줄이 바뀌었거나 다시 켜졌으면 다음 발송을 지금 기준으로 다시 잡는다(과거 시각 즉시 발사 방지).
  if (scheduleChanged || reEnabled) {
    next.nextRunAt = computeNextRun(next, nowMs);
  }
  await persistDef(next);
  return next;
}

export async function deleteRecurring(roomId: string, id: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  const current = await getRecurring(id);
  // 정의가 이미 없으면 SET/ZSET 만 정리(idempotent).
  if (current && current.roomId !== roomId) return false;
  await redis.del(defKey(id));
  await redis.srem(roomSetKey(roomId), id);
  await redis.zrem(dueKey(), id);
  return true;
}

// ── cron 전용 ──

// 발송 시각이 지난(due) 정의 id 목록(가장 이른 것부터). limit 로 한 회차 처리량 제한.
export async function listDueRecurring(nowMs: number, limit: number): Promise<string[]> {
  const redis = getClient();
  if (!redis) return [];
  const ids = (await redis.zrange(dueKey(), 0, nowMs, { byScore: true, offset: 0, count: limit })) as string[];
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}

// 발송 처리 동시성 락 — 동시 cron 이 같은 정의를 중복 발송하지 않게. 성공 후 advance 로 nextRunAt 전진.
export async function acquireRecurringRunLock(id: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true;
  const res = await redis.set(runLockKey(id), "1", { nx: true, ex: RUN_LOCK_TTL_SECONDS });
  return res === "OK";
}
export async function releaseRecurringRunLock(id: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(runLockKey(id));
}

// 발송 성공 후 lastRunAt 기록 + nextRunAt 전진 + due ZSET score 갱신.
export async function advanceRecurringAfterRun(def: FinzRecurringMessage, nowMs: number): Promise<void> {
  const advanced: FinzRecurringMessage = {
    ...def,
    lastRunAt: nowMs,
    nextRunAt: computeNextRun(def, nowMs),
  };
  await persistDef(advanced);
}

// 방·정의가 소멸했을 때 cron 이 due ZSET·정의를 정리(고아 제거).
export async function purgeRecurring(id: string, roomId?: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.del(defKey(id));
  await redis.zrem(dueKey(), id);
  if (roomId) await redis.srem(roomSetKey(roomId), id);
}
