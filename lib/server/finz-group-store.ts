// 서버 전용: FINZ 2인 파티의 "신원"(누가 이 방에 있나)을 Upstash Redis 에 7일 TTL 로 저장한다.
// 대화(픽·포지션·요약·자유텍스트)는 더 이상 이 blob 에 없다 — 별도 append-only LIST
// (lib/server/finz-chat-store.ts, sw:finz:chat:<id>) 가 단일 소스다. 이 blob 은 id/members/타임스탬프만.
// 멤버는 selectedCardIds 만 저장하고 캐릭터는 렌더 시 buildFinzProfile 로 재구성한다(카탈로그 변경 내성).
//
// 식별은 로그인(email)이 아니라 클라이언트가 만든 memberId 다. 파티 라우트는 getCurrentUser 를
// 절대 호출하지 않는다. (주의: memberId 는 위조 가능한 클라이언트 값 — GET 이 양쪽 memberId 를 노출하므로
// 한 멤버가 다른 멤버인 척 쓰는 것은 막지 못한다. 2인 신뢰 파티 기준 수용(payoff 없음). 단, 채팅 append
// 계층은 role/authorId 를 finz/system 으로 위조하는 것은 하드 거절하고 authorName 은 서버에서 조회한다.
// 비신뢰/다중 파티로 넓힐 땐 join 시 서버 발급 토큰으로 보강할 것 — 후속 과제.)

import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";
import { buildFinzProfile } from "@/lib/common/services/finz";

export const FINZ_GROUP_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_MEMBERS = 2;
const ID_LENGTH = 6;
const MAX_ID_ATTEMPTS = 12;
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_NAME_LENGTH = 24;
// 채팅 포지션 코멘트 길이 상한 — finz-chat-store 가 import 해서 쓴다.
export const MAX_NOTE_LENGTH = 80;

export type FinzGroupMember = {
  memberId: string;
  displayName: string;
  selectedCardIds: string[];
  joinedAt: string;
};

// 신원 전용. 픽/포지션/요약은 채팅 LIST 로 이동했다(더 이상 여기 없음).
export type FinzGroup = {
  id: string;
  members: FinzGroupMember[];
  createdAt: string;
  expiresAt: string;
};

export type JoinResult =
  | { status: "ok"; group: FinzGroup }
  | { status: "already-member"; group: FinzGroup }
  | { status: "full"; group: FinzGroup };

let cachedClient: Redis | null | undefined;

// finz-chat-store 가 같은 싱글톤을 공유해야 read-your-writes 일관성(인덱스=seq, 락)이 유지된다.
export function getClient(): Redis | null {
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

export function groupKey(id: string): string {
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

  // 레거시 blob 의 pick/positions/summary 필드는 무시한다(대화는 채팅 LIST 로 이동).
  // 이런 옛 필드가 있어도 거절하지 않고 신원만 뽑아 유효한 그룹으로 돌려준다.
  return { id, members, createdAt, expiresAt };
}

function generateGroupId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let out = "";
  for (const byte of bytes) {
    out += ID_CHARS[byte % ID_CHARS.length];
  }
  return out;
}

// Upstash 1.37 은 자동 역직렬화가 켜져 있어 get/lrange 가 객체를 돌려줄 수 있다 — 객체면 그대로,
// 문자열이면 JSON.parse. finz-chat-store 가 LIST 원소 파싱에 그대로 재사용한다.
export function parseJsonSafe(raw: unknown): Record<string, unknown> | null {
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
