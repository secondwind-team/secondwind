import { NextResponse } from "next/server";
import type { FinzRoomSummary } from "@/lib/common/services/finz-account";
import { requireAccount } from "@/lib/server/finz-account";
import {
  getAccount,
  getAccountByHandle,
  isFinzAccountStoreConfigured,
  pushFeedEvent,
} from "@/lib/server/finz-account-store";
import {
  buildRoomMemberFromAccount,
  createFinzRoom,
  getFinzGroup,
  isFinzPartyConfigured,
  listRoomIdsForAccount,
  removeRoomFromAccountIndex,
  type FinzGroup,
  type FinzGroupMember,
} from "@/lib/server/finz-group-store";
import { appendSystemMessage, getRoomLastMessage } from "@/lib/server/finz-chat-store";
import { buildRoomSummary } from "@/lib/server/finz-room";

export const runtime = "nodejs";

function ready() {
  return isFinzAccountStoreConfigured() && isFinzPartyConfigured();
}

// 내 대화방 목록(최근 활동순). 소멸한 방은 인덱스에서 self-heal.
export async function GET() {
  if (!ready()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });
  try {
    const ids = await listRoomIdsForAccount(me.accountId);
    // 방마다 group + 마지막 메시지를 병렬로 — 순차 await(N×2 왕복)는 방이 늘면 느려진다.
    // ids 는 최근활동순이고 Promise.all 이 순서를 보존하므로 정렬도 유지된다.
    const settled = await Promise.all(
      ids.map(async (id) => {
        const [group, last] = await Promise.all([getFinzGroup(id), getRoomLastMessage(id)]);
        if (!group) {
          void removeRoomFromAccountIndex(me.accountId, id).catch(() => {});
          return null;
        }
        return buildRoomSummary(group, me.accountId, last);
      }),
    );
    const rooms = settled.filter((r): r is FinzRoomSummary => r !== null);
    return NextResponse.json({ status: "ok", rooms });
  } catch (e) {
    console.error("[finz/rooms] GET 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

type CreateBody = {
  kind?: unknown;
  title?: unknown;
  targetHandle?: unknown;
  targetAccountId?: unknown;
  friendIds?: unknown;
};

// 새 대화방 생성. 1on1(상대 1명) 또는 group(친구 여러 명 또는 나만 + 나중에 초대).
export async function POST(req: Request) {
  if (!ready()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const kind = body.kind === "group" ? "group" : "1on1";
  const title = typeof body.title === "string" ? body.title.slice(0, 40) : "";

  const meMember = buildRoomMemberFromAccount(me);
  if (!meMember) return NextResponse.json({ status: "invalid", reason: "my-character" }, { status: 400 });

  try {
    if (kind === "1on1") {
      // 상대 해석: targetAccountId 또는 targetHandle.
      const targetId = typeof body.targetAccountId === "string" ? body.targetAccountId : "";
      const targetHandle = typeof body.targetHandle === "string" ? body.targetHandle : "";
      const target = targetId ? await getAccount(targetId) : targetHandle ? await getAccountByHandle(targetHandle) : null;
      if (!target) return NextResponse.json({ status: "not-found", reason: "target" }, { status: 404 });
      if (target.accountId === me.accountId) {
        return NextResponse.json({ status: "invalid", reason: "self" }, { status: 400 });
      }
      const otherMember = buildRoomMemberFromAccount(target);
      if (!otherMember) return NextResponse.json({ status: "invalid", reason: "target-character" }, { status: 400 });

      // 이미 둘만의 1on1 방이 있으면 재사용(중복 방 방지).
      const existing = await findExisting1on1(me.accountId, target.accountId);
      if (existing) {
        const last = await getRoomLastMessage(existing.id);
        return NextResponse.json({ status: "ok", roomId: existing.id, room: buildRoomSummary(existing, me.accountId, last), reused: true });
      }

      const created = await createFinzRoom({ members: [meMember, otherMember], kind: "1on1", title: "" });
      if (!created) return NextResponse.json({ status: "error" }, { status: 503 });
      void pushFeedEvent({ actorId: me.accountId, type: "room_created", roomId: created.id }).catch(() => {});
      return NextResponse.json({ status: "ok", roomId: created.id, room: buildRoomSummary(created.group, me.accountId, null) });
    }

    // group: 선택한 친구들(friendIds)을 초기 멤버로. 비어 있으면 나만(나중에 초대).
    const friendIds = Array.isArray(body.friendIds)
      ? body.friendIds.filter((x): x is string => typeof x === "string").slice(0, 11)
      : [];
    const members: FinzGroupMember[] = [meMember];
    for (const fid of friendIds) {
      if (fid === me.accountId) continue;
      const acc = await getAccount(fid);
      if (!acc) continue;
      const m = buildRoomMemberFromAccount(acc);
      if (m && !members.some((x) => x.memberId === m.memberId)) members.push(m);
    }
    const created = await createFinzRoom({ members, kind: "group", title });
    if (!created) return NextResponse.json({ status: "error" }, { status: 503 });
    void appendSystemMessage(created.id, `${me.displayName}님이 대화방을 만들었어요.`).catch(() => {});
    void pushFeedEvent({ actorId: me.accountId, type: "room_created", title: title || undefined, roomId: created.id }).catch(() => {});
    return NextResponse.json({ status: "ok", roomId: created.id, room: buildRoomSummary(created.group, me.accountId, null) });
  } catch (e) {
    console.error("[finz/rooms] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

// 두 계정만의 기존 1on1 방을 찾는다(내 방 인덱스 스캔 — 데모 규모에 충분).
async function findExisting1on1(meId: string, otherId: string): Promise<FinzGroup | null> {
  const ids = await listRoomIdsForAccount(meId);
  for (const id of ids) {
    const g = await getFinzGroup(id);
    if (!g || g.kind !== "1on1" || g.members.length !== 2) continue;
    const set = new Set(g.members.map((m) => m.memberId));
    if (set.has(meId) && set.has(otherId)) return g;
  }
  return null;
}
