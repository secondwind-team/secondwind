import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
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

// 링크로 들어온 사람이 자기 계정으로 방에 합류(불특정 다수 허용). 세션 인증 — 취향 재선택 없음.
export async function POST(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  if (!isFinzAccountStoreConfigured() || !isFinzPartyConfigured()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  const member = buildRoomMemberFromAccount(me);
  if (!member) return NextResponse.json({ status: "invalid", reason: "my-character" }, { status: 400 });

  try {
    const res = await addMemberToRoom(groupId, member);
    if (res.status === "not-found") return NextResponse.json({ status: "not-found" }, { status: 404 });
    if (res.status === "full") return NextResponse.json({ status: "full" }, { status: 409 });
    if (res.status === "ok") {
      void appendSystemMessage(groupId, `${me.displayName}님이 들어왔어요.`).catch(() => {});
    }
    const group = res.group ?? (await getFinzGroup(groupId));
    return NextResponse.json({
      status: "ok",
      already: res.status === "already-member",
      room: group ? buildRoomSummary(group, me.accountId, null) : null,
    });
  } catch (e) {
    console.error("[finz/rooms/join] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
