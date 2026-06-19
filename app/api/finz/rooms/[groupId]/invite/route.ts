import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { getAccount, getAccountByHandle, isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
import {
  addMemberToRoom,
  buildRoomMemberFromAccount,
  getFinzGroup,
  isFinzGroupId,
  isFinzPartyConfigured,
} from "@/lib/server/finz-group-store";
import { appendSystemMessage } from "@/lib/server/finz-chat-store";
import { buildRoomSummary } from "@/lib/server/finz-room";

export const runtime = "nodejs";

// 대화방에 친구를 초대(accountIds 또는 handles). 호출자는 방 멤버여야 한다(세션 인증).
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  if (!isFinzAccountStoreConfigured() || !isFinzPartyConfigured()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === me.accountId)) {
    return NextResponse.json({ status: "forbidden", reason: "not-member" }, { status: 403 });
  }

  let body: { accountIds?: unknown; handles?: unknown };
  try {
    body = (await req.json()) as { accountIds?: unknown; handles?: unknown };
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const accountIds = Array.isArray(body.accountIds) ? body.accountIds.filter((x): x is string => typeof x === "string") : [];
  const handles = Array.isArray(body.handles) ? body.handles.filter((x): x is string => typeof x === "string") : [];

  try {
    const added: string[] = [];
    let full = false;
    for (const id of accountIds) {
      const acc = await getAccount(id);
      if (acc) {
        const r = await tryAdd(groupId, acc);
        if (r === "ok") added.push(acc.displayName);
        if (r === "full") full = true;
      }
    }
    for (const h of handles) {
      const acc = await getAccountByHandle(h);
      if (acc) {
        const r = await tryAdd(groupId, acc);
        if (r === "ok") added.push(acc.displayName);
        if (r === "full") full = true;
      }
    }
    for (const name of added) {
      void appendSystemMessage(groupId, `${name}님이 들어왔어요.`).catch(() => {});
    }
    const after = await getFinzGroup(groupId);
    return NextResponse.json({
      status: "ok",
      added,
      full,
      room: after ? buildRoomSummary(after, me.accountId, null) : null,
    });
  } catch (e) {
    console.error("[finz/rooms/invite] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

async function tryAdd(
  groupId: string,
  account: { accountId: string; handle: string; displayName: string; selectedCardIds: string[] },
): Promise<"ok" | "already-member" | "full" | "skip"> {
  const member = buildRoomMemberFromAccount(account);
  if (!member) return "skip";
  const res = await addMemberToRoom(groupId, member);
  return res.status === "not-found" ? "skip" : res.status;
}
