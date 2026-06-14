// 서버 전용: FINZ 2인 파티를 Upstash Redis 에 7일 TTL 로 저장한다.
// travel-share-store 의 create/get 패턴을 그대로 미러링하되, 파티는 join(멤버 추가)이
// 필요하므로 read-modify-write 를 더한다. 멤버는 selectedCardIds 만 저장하고 캐릭터는
// 렌더 시 buildFinzProfile 로 재구성한다(카탈로그 변경으로 파티 전체가 죽지 않게).
//
// 식별은 로그인(email)이 아니라 클라이언트가 만든 memberId 다. 파티 라우트는 getCurrentUser 를
// 절대 호출하지 않는다. (주의: memberId 는 위조 가능한 클라이언트 값 — MVP-03 은 join 이후 멤버별
// 쓰기가 없어 영향이 거의 없지만, MVP-04 에서 멤버별 mutable 쓰기를 붙이기 전 보강 필요.)

import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";
import {
  buildFinzProfile,
  isFinzPartyPick,
  isFinzPartyPosition,
  isFinzPartySummary,
  type FinzPartyPick,
  type FinzPartyPosition,
  type FinzPartyStance,
  type FinzPartySummary,
} from "@/lib/common/services/finz";

export const FINZ_GROUP_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_MEMBERS = 2;
const ID_LENGTH = 6;
const MAX_ID_ATTEMPTS = 12;
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_NAME_LENGTH = 24;
const MAX_NOTE_LENGTH = 80;

export type FinzGroupMember = {
  memberId: string;
  displayName: string;
  selectedCardIds: string[];
  joinedAt: string;
};

export type FinzGroup = {
  id: string;
  members: FinzGroupMember[];
  createdAt: string;
  expiresAt: string;
  // 파티 우정주 픽(MVP-04). 2명이 다 모인 뒤 생성. 깨진 픽은 parseGroup 에서 드롭(파티는 유지).
  pick?: FinzPartyPick;
  // 멤버별 한 줄 포지션 + AI 1-shot 요약(MVP-05). 둘 다 optional — 옛 blob 도 파싱되게.
  positions?: FinzPartyPosition[];
  summary?: FinzPartySummary;
};

export type JoinResult =
  | { status: "ok"; group: FinzGroup }
  | { status: "already-member"; group: FinzGroup }
  | { status: "full"; group: FinzGroup };

let cachedClient: Redis | null | undefined;

function getClient(): Redis | null {
  if (cachedClient === undefined) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    cachedClient = url && token ? new Redis({ url, token }) : null;
  }
  return cachedClient;
}

export function isFinzPartyConfigured(): boolean {
  return getClient() !== null;
}

function groupKey(id: string): string {
  return `sw:finz:group:${id}`;
}

export function isFinzGroupId(id: string): boolean {
  return new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(id);
}

// selectedCardIds 가 유효한 프로필(>=3 카드)을 만드는지 검증한 뒤 최소 멤버 blob 을 만든다.
// displayName 은 trim·길이 제한하고, 비면 캐릭터 클래스명으로 대체한다. null 이면 카드 부족.
export function buildFinzGroupMember(input: {
  memberId: string;
  displayName?: string;
  selectedCardIds: string[];
  joinedAt?: string;
}): FinzGroupMember | null {
  if (typeof input.memberId !== "string" || input.memberId.trim().length === 0) return null;
  const profile = buildFinzProfile(input.selectedCardIds);
  if (!profile) return null;

  const trimmed = (input.displayName ?? "").trim().slice(0, MAX_NAME_LENGTH);
  const displayName = trimmed.length > 0 ? trimmed : profile.character.className;

  return {
    memberId: input.memberId,
    displayName,
    selectedCardIds: profile.selectedCardIds,
    joinedAt: input.joinedAt ?? new Date().toISOString(),
  };
}

// 순수 함수 — join 상태머신. redis I/O 없이 단위 테스트 가능.
// 동시 join 레이스는 2인 직렬 트래픽 기준 last-write-wins 로 의식적 수용(문서화).
export function applyJoinToGroup(
  group: FinzGroup,
  member: FinzGroupMember,
  maxMembers: number = MAX_MEMBERS,
): JoinResult {
  if (group.members.some((m) => m.memberId === member.memberId)) {
    return { status: "already-member", group };
  }
  if (group.members.length >= maxMembers) {
    return { status: "full", group };
  }
  return { status: "ok", group: { ...group, members: [...group.members, member] } };
}

export async function createFinzGroup(member: FinzGroupMember): Promise<{ id: string; group: FinzGroup } | null> {
  const redis = getClient();
  if (!redis) return null;

  const now = Date.now();
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const id = generateGroupId();
    const key = groupKey(id);
    const exists = await redis.exists(key);
    if (exists) continue;

    const group: FinzGroup = {
      id,
      members: [member],
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + FINZ_GROUP_TTL_SECONDS * 1000).toISOString(),
    };
    await redis.set(key, JSON.stringify(group), { ex: FINZ_GROUP_TTL_SECONDS });
    return { id, group };
  }
  throw new Error("finz-group-id-collision");
}

export async function getFinzGroup(id: string): Promise<FinzGroup | null> {
  if (!isFinzGroupId(id)) return null;
  const redis = getClient();
  if (!redis) return null;
  const raw = await redis.get(groupKey(id));
  return parseGroup(raw);
}

export async function joinFinzGroup(
  id: string,
  member: FinzGroupMember,
): Promise<{ status: "ok" | "already-member" | "full" | "not-found"; group?: FinzGroup }> {
  if (!isFinzGroupId(id)) return { status: "not-found" };
  const redis = getClient();
  if (!redis) return { status: "not-found" };

  const current = parseGroup(await redis.get(groupKey(id)));
  if (!current) return { status: "not-found" };

  const result = applyJoinToGroup(current, member);
  if (result.status === "ok") {
    // re-set 으로 TTL 도 갱신
    await redis.set(groupKey(id), JSON.stringify(result.group), { ex: FINZ_GROUP_TTL_SECONDS });
  }
  return { status: result.status, group: result.group };
}

export async function setFinzGroupPick(
  id: string,
  pick: FinzPartyPick,
  opts: { force?: boolean } = {},
): Promise<{ status: "ok" | "not-found" | "not-full"; group?: FinzGroup }> {
  if (!isFinzGroupId(id)) return { status: "not-found" };
  const redis = getClient();
  if (!redis) return { status: "not-found" };

  const current = parseGroup(await redis.get(groupKey(id)));
  if (!current) return { status: "not-found" };
  if (current.members.length < MAX_MEMBERS) return { status: "not-full" };

  // compare-and-skip: 두 멤버가 동시에 "열기"를 눌러도 이미 픽이 있으면 덮어쓰지 않는다
  // (둘째 호출의 낭비 쓰기·flicker 방지, force 면 갱신).
  if (current.pick && !opts.force) return { status: "ok", group: current };

  const next: FinzGroup = { ...current, pick };
  await redis.set(groupKey(id), JSON.stringify(next), { ex: FINZ_GROUP_TTL_SECONDS });
  return { status: "ok", group: next };
}

// 순수 함수 — 포지션 upsert(멤버별 1개, memberId 로 교체/추가). 멤버가 아니면 not-member.
// 포지션이 바뀌면 기존 요약을 무효화(제거)해 stale 요약이 안 남게 한다.
export function applyPositionUpsert(
  group: FinzGroup,
  position: FinzPartyPosition,
): { status: "ok" | "not-member"; group: FinzGroup } {
  if (!group.members.some((m) => m.memberId === position.memberId)) {
    return { status: "not-member", group };
  }
  const positions = [...(group.positions ?? []).filter((p) => p.memberId !== position.memberId), position];
  const next: FinzGroup = { ...group, positions };
  delete next.summary;
  return { status: "ok", group: next };
}

export async function setFinzGroupPosition(
  id: string,
  input: { memberId: string; stance: FinzPartyStance; note: string },
): Promise<{ status: "ok" | "not-found" | "not-full" | "not-member"; group?: FinzGroup }> {
  if (!isFinzGroupId(id)) return { status: "not-found" };
  const redis = getClient();
  if (!redis) return { status: "not-found" };

  const current = parseGroup(await redis.get(groupKey(id)));
  if (!current) return { status: "not-found" };
  if (current.members.length < MAX_MEMBERS) return { status: "not-full" };

  const position: FinzPartyPosition = {
    memberId: input.memberId,
    stance: input.stance,
    note: input.note.trim().slice(0, MAX_NOTE_LENGTH),
    createdAt: new Date().toISOString(),
  };
  const result = applyPositionUpsert(current, position);
  if (result.status === "not-member") return { status: "not-member" };

  await redis.set(groupKey(id), JSON.stringify(result.group), { ex: FINZ_GROUP_TTL_SECONDS });
  return { status: "ok", group: result.group };
}

export async function setFinzGroupSummary(
  id: string,
  summary: FinzPartySummary,
): Promise<{ status: "ok" | "not-found" | "not-full"; group?: FinzGroup }> {
  if (!isFinzGroupId(id)) return { status: "not-found" };
  const redis = getClient();
  if (!redis) return { status: "not-found" };

  const current = parseGroup(await redis.get(groupKey(id)));
  if (!current) return { status: "not-found" };
  if (current.members.length < MAX_MEMBERS) return { status: "not-full" };

  // compare-and-skip: 이미 요약이 있으면 덮어쓰지 않는다(동시 생성 낭비 방지).
  // 포지션이 바뀌면 applyPositionUpsert 가 summary 를 지우므로 자연히 재생성된다(별도 force 불필요).
  if (current.summary) return { status: "ok", group: current };

  const next: FinzGroup = { ...current, summary };
  await redis.set(groupKey(id), JSON.stringify(next), { ex: FINZ_GROUP_TTL_SECONDS });
  return { status: "ok", group: next };
}

export function isFinzGroupMember(value: unknown): value is FinzGroupMember {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<FinzGroupMember>;
  return (
    typeof m.memberId === "string" &&
    m.memberId.length > 0 &&
    typeof m.displayName === "string" &&
    Array.isArray(m.selectedCardIds) &&
    m.selectedCardIds.every((c) => typeof c === "string") &&
    m.selectedCardIds.length > 0 &&
    typeof m.joinedAt === "string"
  );
}

export function parseGroup(raw: unknown): FinzGroup | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed) return null;

  const id = typeof parsed.id === "string" ? parsed.id : "";
  if (!isFinzGroupId(id)) return null;

  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : "";
  const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;

  if (!Array.isArray(parsed.members)) return null;
  const members = parsed.members.filter(isFinzGroupMember);
  if (members.length === 0 || members.length > MAX_MEMBERS) return null;

  // 픽·포지션·요약 모두 관용적으로 — 깨진 것은 드롭하되 파티 자체는 유효하게 유지.
  const pick = isFinzPartyPick(parsed.pick) ? (parsed.pick as FinzPartyPick) : undefined;
  const positions = Array.isArray(parsed.positions)
    ? parsed.positions.filter(isFinzPartyPosition)
    : [];
  const summary = isFinzPartySummary(parsed.summary) ? (parsed.summary as FinzPartySummary) : undefined;
  return {
    id,
    members,
    createdAt,
    expiresAt,
    ...(pick ? { pick } : {}),
    ...(positions.length ? { positions } : {}),
    ...(summary ? { summary } : {}),
  };
}

function generateGroupId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let out = "";
  for (const byte of bytes) {
    out += ID_CHARS[byte % ID_CHARS.length];
  }
  return out;
}

function parseJsonSafe(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
