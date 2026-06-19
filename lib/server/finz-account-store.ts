// 서버 전용: FINZ 메신저의 "소셜 신원" 계층을 Neon Postgres 에 영구 저장한다.
// 계정/핸들/인증연결/친구그래프/피드 — TTL 없는 영구 데이터(친구가 7일 뒤 사라지면 안 됨).
// 대화방/메시지(Redis, 7~30일 TTL)와 의도적으로 분리: 여긴 "누구인가/누구와 친구인가/무엇을 했나".
//
// 기존 finz-store.ts 와 같은 런타임 지연 스키마 패턴(CREATE TABLE IF NOT EXISTS)을 따른다 —
// 별도 마이그레이션 의식 없음. DATABASE_URL 미설정이면 throw(라우트가 503 으로 감싼다).
//
// Google 로그인은 인증만. 계정/핸들은 FINZ 소유 — authlink(provider, providerId)→accountId 로
// 연결해 추후 다른 로그인도 같은 계정에 귀속 가능(provider-agnostic).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import {
  isValidHandle,
  normalizeHandle,
  type FinzAccount,
  type FinzAccountSummary,
  type FinzFeedEvent,
  type FinzFeedType,
  type FinzFriendEntry,
  type FinzFriendsView,
} from "@/lib/common/services/finz-account";

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function isFinzAccountStoreConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getSql() {
  if (client) return client;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  client = neon(databaseUrl);
  return client;
}

async function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS finz_accounts (
          account_id TEXT PRIMARY KEY,
          handle TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          selected_card_ids JSONB NOT NULL,
          bio TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS finz_auth_links (
          provider TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (provider, provider_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS finz_friendships (
          requester TEXT NOT NULL,
          addressee TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (requester, addressee)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS finz_feed_events (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT,
          room_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS finz_feed_actor_idx
        ON finz_feed_events (actor_id, created_at DESC)
      `;
    })();
  }
  return schemaReady;
}

// ── 계정 ──

function genAccountId(): string {
  return `acct_${crypto.randomUUID().replace(/-/g, "")}`;
}

function rowToAccount(row: Record<string, unknown>): FinzAccount {
  return {
    accountId: row.account_id as string,
    handle: row.handle as string,
    displayName: row.display_name as string,
    selectedCardIds: asStringArray(row.selected_card_ids),
    bio: (row.bio as string | null) ?? "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

// 인증(provider, providerId)에 연결된 FINZ 계정을 찾는다. 없으면 null → 온보딩 필요.
export async function getAccountForAuth(provider: string, providerId: string): Promise<FinzAccount | null> {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT a.account_id, a.handle, a.display_name, a.selected_card_ids, a.bio, a.created_at, a.updated_at
    FROM finz_auth_links l
    JOIN finz_accounts a ON a.account_id = l.account_id
    WHERE l.provider = ${provider} AND l.provider_id = ${providerId}
    LIMIT 1
  `;
  return row ? rowToAccount(row) : null;
}

export async function getAccount(accountId: string): Promise<FinzAccount | null> {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT account_id, handle, display_name, selected_card_ids, bio, created_at, updated_at
    FROM finz_accounts WHERE account_id = ${accountId} LIMIT 1
  `;
  return row ? rowToAccount(row) : null;
}

export async function getAccountByHandle(handleInput: string): Promise<FinzAccount | null> {
  const handle = normalizeHandle(handleInput);
  if (!isValidHandle(handle)) return null;
  await ensureSchema();
  const [row] = await getSql()`
    SELECT account_id, handle, display_name, selected_card_ids, bio, created_at, updated_at
    FROM finz_accounts WHERE handle = ${handle} LIMIT 1
  `;
  return row ? rowToAccount(row) : null;
}

// 여러 accountId 의 요약을 한 번에(친구/멤버 목록 enrich 용).
export async function getAccountSummaries(ids: string[]): Promise<Map<string, FinzAccountSummary>> {
  const out = new Map<string, FinzAccountSummary>();
  if (ids.length === 0) return out;
  await ensureSchema();
  const rows = await getSql()`
    SELECT account_id, handle, display_name, selected_card_ids
    FROM finz_accounts WHERE account_id = ANY(${ids})
  `;
  for (const row of rows as Record<string, unknown>[]) {
    out.set(row.account_id as string, {
      accountId: row.account_id as string,
      handle: row.handle as string,
      displayName: row.display_name as string,
      selectedCardIds: asStringArray(row.selected_card_ids),
    });
  }
  return out;
}

export type CreateAccountResult =
  | { status: "ok"; account: FinzAccount }
  | { status: "handle-taken" }
  | { status: "invalid" };

// 온보딩: 인증 사용자에게 핸들/캐릭터를 붙여 FINZ 계정을 만든다.
// 핸들 유니크 충돌은 handle-taken. 이미 이 인증에 계정이 있으면 그걸 돌려준다(멱등).
export async function createAccountForAuth(input: {
  provider: string;
  providerId: string;
  handle: string;
  displayName: string;
  selectedCardIds: string[];
  bio?: string;
}): Promise<CreateAccountResult> {
  await ensureSchema();
  const existing = await getAccountForAuth(input.provider, input.providerId);
  if (existing) return { status: "ok", account: existing };

  const handle = normalizeHandle(input.handle);
  if (!isValidHandle(handle)) return { status: "invalid" };
  const displayName = input.displayName.trim().slice(0, 24) || handle;
  if (input.selectedCardIds.length < 3) return { status: "invalid" };

  const taken = await getAccountByHandle(handle);
  if (taken) return { status: "handle-taken" };

  const sql = getSql();
  const accountId = genAccountId();
  // 핸들 유니크 제약을 신뢰 — 레이스로 동시 INSERT 가 끼면 ON CONFLICT 로 흡수하고 재확인.
  const inserted = await sql`
    INSERT INTO finz_accounts (account_id, handle, display_name, selected_card_ids, bio)
    VALUES (${accountId}, ${handle}, ${displayName}, ${JSON.stringify(input.selectedCardIds)}::jsonb, ${input.bio?.slice(0, 120) ?? ""})
    ON CONFLICT (handle) DO NOTHING
    RETURNING account_id
  `;
  if (inserted.length === 0) return { status: "handle-taken" };

  await sql`
    INSERT INTO finz_auth_links (provider, provider_id, account_id)
    VALUES (${input.provider}, ${input.providerId}, ${accountId})
    ON CONFLICT (provider, provider_id) DO NOTHING
  `;

  const account = await getAccount(accountId);
  return account ? { status: "ok", account } : { status: "invalid" };
}

export type UpdateAccountResult =
  | { status: "ok"; account: FinzAccount }
  | { status: "handle-taken" }
  | { status: "invalid" }
  | { status: "not-found" };

// 프로필 편집(핸들/이름/캐릭터/소개). 핸들 변경 시 유니크 검사.
export async function updateAccount(
  accountId: string,
  patch: { handle?: string; displayName?: string; selectedCardIds?: string[]; bio?: string },
): Promise<UpdateAccountResult> {
  await ensureSchema();
  const current = await getAccount(accountId);
  if (!current) return { status: "not-found" };

  let handle = current.handle;
  if (patch.handle !== undefined) {
    const next = normalizeHandle(patch.handle);
    if (!isValidHandle(next)) return { status: "invalid" };
    if (next !== current.handle) {
      const taken = await getAccountByHandle(next);
      if (taken) return { status: "handle-taken" };
      handle = next;
    }
  }
  const displayName =
    patch.displayName !== undefined ? patch.displayName.trim().slice(0, 24) || handle : current.displayName;
  const selectedCardIds =
    patch.selectedCardIds !== undefined ? patch.selectedCardIds : current.selectedCardIds;
  if (selectedCardIds.length < 3) return { status: "invalid" };
  const bio = patch.bio !== undefined ? patch.bio.slice(0, 120) : current.bio;

  await getSql()`
    UPDATE finz_accounts SET
      handle = ${handle},
      display_name = ${displayName},
      selected_card_ids = ${JSON.stringify(selectedCardIds)}::jsonb,
      bio = ${bio},
      updated_at = NOW()
    WHERE account_id = ${accountId}
  `;
  const account = await getAccount(accountId);
  return account ? { status: "ok", account } : { status: "not-found" };
}

// ── 친구 그래프 ──
// 방향 1행(requester, addressee, status). 친구(accepted)는 양방향으로 조회한다.

export type FriendRequestResult =
  | { status: "ok"; state: "requested" | "accepted" }
  | { status: "self" }
  | { status: "not-found" }
  | { status: "already-friends" }
  | { status: "already-requested" };

export async function requestFriendByHandle(me: string, targetHandle: string): Promise<FriendRequestResult> {
  await ensureSchema();
  const target = await getAccountByHandle(targetHandle);
  if (!target) return { status: "not-found" };
  if (target.accountId === me) return { status: "self" };

  const sql = getSql();
  // 이미 어떤 관계든 있는지(양방향) 확인.
  const rows = await sql`
    SELECT requester, addressee, status FROM finz_friendships
    WHERE (requester = ${me} AND addressee = ${target.accountId})
       OR (requester = ${target.accountId} AND addressee = ${me})
    LIMIT 2
  `;
  for (const r of rows as Record<string, unknown>[]) {
    if (r.status === "accepted") return { status: "already-friends" };
    if (r.requester === me) return { status: "already-requested" };
    // 상대가 먼저 나에게 보낸 pending 이 있으면 → 수락(상호 친구).
    if (r.requester === target.accountId) {
      await sql`
        UPDATE finz_friendships SET status = 'accepted', updated_at = NOW()
        WHERE requester = ${target.accountId} AND addressee = ${me}
      `;
      return { status: "ok", state: "accepted" };
    }
  }
  await sql`
    INSERT INTO finz_friendships (requester, addressee, status)
    VALUES (${me}, ${target.accountId}, 'pending')
    ON CONFLICT (requester, addressee) DO NOTHING
  `;
  return { status: "ok", state: "requested" };
}

// 나에게 온 pending 요청을 수락/거절. otherId = 요청 보낸 사람.
export async function respondToFriendRequest(
  me: string,
  otherId: string,
  accept: boolean,
): Promise<{ status: "ok" | "not-found" }> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM finz_friendships
    WHERE requester = ${otherId} AND addressee = ${me} AND status = 'pending' LIMIT 1
  `;
  if (rows.length === 0) return { status: "not-found" };
  if (accept) {
    await sql`
      UPDATE finz_friendships SET status = 'accepted', updated_at = NOW()
      WHERE requester = ${otherId} AND addressee = ${me}
    `;
  } else {
    await sql`
      DELETE FROM finz_friendships WHERE requester = ${otherId} AND addressee = ${me}
    `;
  }
  return { status: "ok" };
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT 1 FROM finz_friendships
    WHERE status = 'accepted'
      AND ((requester = ${a} AND addressee = ${b}) OR (requester = ${b} AND addressee = ${a}))
    LIMIT 1
  `;
  return rows.length > 0;
}

// accepted 친구 accountId 목록(피드 fan-in·초대 후보용).
export async function listFriendIds(me: string): Promise<string[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT requester, addressee FROM finz_friendships
    WHERE status = 'accepted' AND (requester = ${me} OR addressee = ${me})
  `;
  return (rows as Record<string, unknown>[]).map((r) => (r.requester === me ? (r.addressee as string) : (r.requester as string)));
}

export async function getFriendsView(me: string): Promise<FinzFriendsView> {
  await ensureSchema();
  const rows = (await getSql()`
    SELECT requester, addressee, status, updated_at FROM finz_friendships
    WHERE requester = ${me} OR addressee = ${me}
  `) as Record<string, unknown>[];

  const otherIds = new Set<string>();
  for (const r of rows) {
    otherIds.add(r.requester === me ? (r.addressee as string) : (r.requester as string));
  }
  const summaries = await getAccountSummaries([...otherIds]);

  const friends: FinzFriendEntry[] = [];
  const incoming: FinzFriendEntry[] = [];
  const outgoing: FinzFriendEntry[] = [];
  for (const r of rows) {
    const otherId = r.requester === me ? (r.addressee as string) : (r.requester as string);
    const account = summaries.get(otherId);
    if (!account) continue; // 상대 계정이 사라졌으면 스킵
    const since = toIso(r.updated_at);
    if (r.status === "accepted") {
      friends.push({ account, status: "accepted", since });
    } else if (r.addressee === me) {
      incoming.push({ account, status: "incoming", since });
    } else {
      outgoing.push({ account, status: "outgoing", since });
    }
  }
  return { friends, incoming, outgoing };
}

// ── 피드 ──

export async function pushFeedEvent(input: {
  actorId: string;
  type: FinzFeedType;
  title?: string;
  roomId?: string;
}): Promise<void> {
  await ensureSchema();
  await getSql()`
    INSERT INTO finz_feed_events (id, actor_id, type, title, room_id)
    VALUES (${crypto.randomUUID()}, ${input.actorId}, ${input.type}, ${input.title ?? null}, ${input.roomId ?? null})
  `;
}

// 내 피드 = (내 친구들 ∪ 나)의 최근 활동. fan-in 조회(친구 적은 데모 단계에 충분).
export async function getFeed(me: string, limit = 50): Promise<FinzFeedEvent[]> {
  await ensureSchema();
  const actorIds = [me, ...(await listFriendIds(me))];
  const rows = (await getSql()`
    SELECT id, actor_id, type, title, room_id, created_at
    FROM finz_feed_events
    WHERE actor_id = ANY(${actorIds})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  const summaries = await getAccountSummaries([...new Set(rows.map((r) => r.actor_id as string))]);
  const out: FinzFeedEvent[] = [];
  for (const r of rows) {
    const actor = summaries.get(r.actor_id as string);
    if (!actor) continue;
    out.push({
      id: r.id as string,
      actor,
      type: r.type as FinzFeedType,
      title: (r.title as string | null) ?? undefined,
      roomId: (r.room_id as string | null) ?? undefined,
      createdAt: toIso(r.created_at),
    });
  }
  return out;
}

// ── 유틸 ──

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}
