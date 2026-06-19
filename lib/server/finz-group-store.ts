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
import type { FinzRoomKind } from "@/lib/common/services/finz-account";

// 메신저 시대: 대화방을 일주일 만에 잃지 않도록 TTL 을 30일로(기존 7일에서 상향).
export const FINZ_GROUP_TTL_SECONDS = 30 * 24 * 60 * 60;
// 1:1 방 정원(레거시 파티와 동일). applyJoinToGroup 의 기본 cap.
export const MAX_MEMBERS = 2;
// 그룹 대화방 정원(불특정 다수 포함). parseGroup 의 상한.
export const MAX_ROOM_MEMBERS = 12;
const ID_LENGTH = 6;
const MAX_ID_ATTEMPTS = 12;
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_NAME_LENGTH = 24;
// 채팅 포지션 코멘트 길이 상한 — finz-chat-store 가 import 해서 쓴다.
export const MAX_NOTE_LENGTH = 80;

export type FinzGroupMember = {
  memberId: string; // 메신저: accountId. 레거시 익명 파티: 클라이언트 UUID.
  displayName: string;
  selectedCardIds: string[];
  joinedAt: string;
  handle?: string; // 메신저 계정 멤버의 핸들(목록/프로필 표시용). 레거시 익명 멤버엔 없음.
};

// 신원 전용. 픽/포지션/요약은 채팅 LIST 로 이동했다(더 이상 여기 없음).
// kind/title 은 메신저 대화방 메타(레거시 blob 엔 없을 수 있어 선택 — parseGroup 이 기본값을 채운다).
export type FinzGroup = {
  id: string;
  members: FinzGroupMember[];
  createdAt: string;
  expiresAt: string;
  kind: FinzRoomKind; // "1on1" | "group"
  title: string; // 그룹방 이름(1on1 은 빈 문자열 — 표시명은 상대 이름으로 도출)
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

// 메신저 계정 → 방 멤버. 캐릭터는 계정의 selectedCardIds 로 재구성(취향 재선택 없음). 핸들도 싣는다.
export function buildRoomMemberFromAccount(account: {
  accountId: string;
  handle: string;
  displayName: string;
  selectedCardIds: string[];
}): FinzGroupMember | null {
  const m = buildFinzGroupMember({
    memberId: account.accountId,
    displayName: account.displayName,
    selectedCardIds: account.selectedCardIds,
  });
  if (!m) return null;
  return { ...m, handle: account.handle };
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
      kind: "1on1",
      title: "",
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
  if (members.length === 0 || members.length > MAX_ROOM_MEMBERS) return null;

  // kind/title 은 메신저 메타. 레거시 blob(없음)은 기본값으로 — 2인이면 1on1, 그 이상이면 group.
  const kind: FinzRoomKind = parsed.kind === "group" || parsed.kind === "1on1" || parsed.kind === "self"
    ? parsed.kind
    : members.length > 2
      ? "group"
      : "1on1";
  const title = typeof parsed.title === "string" ? parsed.title.slice(0, 40) : "";

  // 레거시 blob 의 pick/positions/summary 필드는 무시한다(대화는 채팅 LIST 로 이동).
  // 이런 옛 필드가 있어도 거절하지 않고 신원만 뽑아 유효한 그룹으로 돌려준다.
  return { id, members, createdAt, expiresAt, kind, title };
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

// ── 메신저 대화방 (group 일반화) ──
//
// 방 멤버십 = 계정(memberId = accountId). 생성/초대 시 서버가 계정 요약으로 멤버를 만든다
// (취향 재선택 없음 — 캐릭터는 프로필 소유). "내 대화방 목록"은 계정별 ZSET 인덱스로 조회한다.

function roomsIndexKey(accountId: string): string {
  return `sw:finz:rooms:${accountId}`;
}

// 여러 멤버로 새 방을 만든다. kind/title 지정. 모든 멤버의 방 인덱스에 등록한다.
export async function createFinzRoom(input: {
  members: FinzGroupMember[];
  kind: FinzRoomKind;
  title: string;
}): Promise<{ id: string; group: FinzGroup } | null> {
  const redis = getClient();
  if (!redis) return null;
  if (input.members.length === 0) return null;

  const now = Date.now();
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const id = generateGroupId();
    const key = groupKey(id);
    if (await redis.exists(key)) continue;

    const group: FinzGroup = {
      id,
      members: input.members,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + FINZ_GROUP_TTL_SECONDS * 1000).toISOString(),
      kind: input.kind,
      title: input.title.slice(0, 40),
    };
    await redis.set(key, JSON.stringify(group), { ex: FINZ_GROUP_TTL_SECONDS });
    await indexRoomForMembers(group, now);
    return { id, group };
  }
  throw new Error("finz-room-id-collision");
}

// 기존 방에 계정 멤버를 추가(초대/오픈조인). 그룹 정원은 MAX_ROOM_MEMBERS 까지.
export async function addMemberToRoom(
  id: string,
  member: FinzGroupMember,
): Promise<{ status: "ok" | "already-member" | "full" | "not-found"; group?: FinzGroup }> {
  if (!isFinzGroupId(id)) return { status: "not-found" };
  const redis = getClient();
  if (!redis) return { status: "not-found" };

  const current = parseGroup(await redis.get(groupKey(id)));
  if (!current) return { status: "not-found" };

  const result = applyJoinToGroup(current, member, MAX_ROOM_MEMBERS);
  if (result.status === "ok") {
    // 3인 이상이 되면 1on1 → group 으로 승격(초대로 단톡이 됨).
    const persisted: FinzGroup =
      result.group.members.length > 2 && result.group.kind === "1on1"
        ? { ...result.group, kind: "group" }
        : result.group;
    await redis.set(groupKey(id), JSON.stringify(persisted), { ex: FINZ_GROUP_TTL_SECONDS });
    await indexRoomForMembers(persisted, Date.now());
    return { status: "ok", group: persisted };
  } else if (result.status === "already-member") {
    // 이미 멤버여도 내 인덱스엔 보이도록 보강(드리프트 자기치유).
    await indexRoomForMembers(result.group, Date.now());
  }
  return { status: result.status, group: result.group };
}

// 그룹의 모든 멤버 인덱스에 roomId 를 score=ts 로 등록/갱신.
async function indexRoomForMembers(group: FinzGroup, scoreMs: number): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  const pipe = redis.pipeline();
  for (const m of group.members) {
    pipe.zadd(roomsIndexKey(m.memberId), { score: scoreMs, member: group.id });
  }
  await pipe.exec();
}

// 메시지 append 시 호출 — 방을 멤버들의 목록 상단으로 끌어올린다(최근 활동순 정렬).
export async function touchRoomActivity(group: FinzGroup): Promise<void> {
  await indexRoomForMembers(group, Date.now());
}

// 내 대화방 id 목록(최근 활동순). 만료/소멸한 방은 self-heal 로 인덱스에서 제거.
export async function listRoomIdsForAccount(accountId: string): Promise<string[]> {
  const redis = getClient();
  if (!redis) return [];
  const ids = (await redis.zrange(roomsIndexKey(accountId), 0, -1, { rev: true })) as string[];
  return ids.filter((id) => typeof id === "string" && isFinzGroupId(id));
}

export async function removeRoomFromAccountIndex(accountId: string, roomId: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.zrem(roomsIndexKey(accountId), roomId);
}

// "나와의 채팅" — 계정당 1개의 혼자 방(메모·AI 테스트용). 포인터로 dedup, 없으면 생성.
// 캐릭터가 없으면 멤버를 못 만들어 null(호출부가 캐릭터 소환 유도).
function selfRoomKey(accountId: string): string {
  return `sw:finz:self:${accountId}`;
}
export async function getOrCreateSelfRoom(account: {
  accountId: string;
  handle: string;
  displayName: string;
  selectedCardIds: string[];
}): Promise<{ id: string; group: FinzGroup } | null> {
  const redis = getClient();
  if (!redis) return null;
  const existing = await redis.get(selfRoomKey(account.accountId));
  if (typeof existing === "string" && isFinzGroupId(existing)) {
    const group = await getFinzGroup(existing);
    if (group) return { id: existing, group };
    // 포인터는 있는데 방이 만료/소멸 → 새로 만든다.
  }
  const member = buildRoomMemberFromAccount(account);
  if (!member) return null;
  const created = await createFinzRoom({ members: [member], kind: "self", title: "나와의 채팅" });
  if (!created) return null;
  await redis.set(selfRoomKey(account.accountId), created.id);
  return created;
}
