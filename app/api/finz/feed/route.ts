import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { getFeed, isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";

export const runtime = "nodejs";

// 내 피드 = (내 친구들 ∪ 나)의 최근 활동(누가 캐릭터 소환/우정주 생성/방 개설/챌린지 달성).
export async function GET() {
  if (!isFinzAccountStoreConfigured()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });
  try {
    const events = await getFeed(me.accountId, 50);
    return NextResponse.json({ status: "ok", events });
  } catch (e) {
    console.error("[finz/feed] GET 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
