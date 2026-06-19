import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
import { getOrCreateSelfRoom, isFinzPartyConfigured } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

// "나와의 채팅" — 계정당 1개의 혼자 방을 가져오거나 만든다(메모·AI 테스트용).
export async function POST() {
  if (!isFinzAccountStoreConfigured() || !isFinzPartyConfigured()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });
  // 방 멤버는 캐릭터가 필요 — 없으면 프로필에서 소환하도록 안내.
  if (me.selectedCardIds.length < 3) return NextResponse.json({ status: "no-character" }, { status: 400 });

  try {
    const room = await getOrCreateSelfRoom(me);
    if (!room) return NextResponse.json({ status: "error" }, { status: 503 });
    return NextResponse.json({ status: "ok", roomId: room.id });
  } catch (e) {
    console.error("[finz/rooms/self] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
