import { NextResponse } from "next/server";
import { MAX_MEMBERS, getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { getChatTail } from "@/lib/server/finz-chat-store";

export const runtime = "nodejs";
// 폴링이 항상 최신 꼬리를 받도록 캐시를 끈다.
export const dynamic = "force-dynamic";

// 라이브 폴링 엔드포인트. ?after=<seq> 이후 메시지만(오름차순) + 멤버 + cursor.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });

  // after 방어적 파싱: NaN/음수면 전체 꼬리(seq 0 환영 메시지가 가려지지 않게).
  const raw = new URL(req.url).searchParams.get("after");
  const n = Number(raw);
  const after = Number.isFinite(n) ? n : -1;

  const tail = await getChatTail(groupId, after < 0 ? -1 : after);

  return NextResponse.json({
    status: "ok",
    members: group.members.map((m) => ({
      memberId: m.memberId,
      displayName: m.displayName,
      selectedCardIds: m.selectedCardIds, // 클라이언트가 buildFinzProfile 로 캐릭터 재구성(카탈로그 내성)
      joinedAt: m.joinedAt,
    })),
    full: group.members.length >= MAX_MEMBERS,
    messages: tail.messages,
    cursor: tail.cursor,
    expiresAt: group.expiresAt,
  });
}
