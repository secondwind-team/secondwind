import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";
// 폴링/룸 렌더가 항상 최신 멤버 상태를 받도록 캐시를 끈다.
// (없으면 App Router 가 정적 캐시해 "1명 상태"가 굳어 두 캐릭터가 안 뜨는 데모-킬러 버그.)
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  const group = await getFinzGroup(groupId);
  if (!group) {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ status: "ok", group });
}
