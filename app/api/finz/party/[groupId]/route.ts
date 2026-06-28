import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { requireAccount } from "@/lib/server/finz-account";

export const runtime = "nodejs";
// 폴링/룸 렌더가 항상 최신 멤버 상태를 받도록 캐시를 끈다.
// (없으면 App Router 가 정적 캐시해 "1명 상태"가 굳어 두 캐릭터가 안 뜨는 데모-킬러 버그.)
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  // 멤버 신원(이름·핸들·취향카드)도 멤버에게만 — chat GET 과 동일한 읽기 가드(비멤버의 그룹 ID 만으로
  // 한 '누가 이 방에 있는가' 열람 차단). 현재 이 GET 은 UI 에서 호출되지 않아 가드를 추가해도 무영향.
  const [group, account] = await Promise.all([getFinzGroup(groupId), requireAccount()]);
  if (!group) {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }
  if (!account || !group.members.some((m) => m.memberId === account.accountId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }
  return NextResponse.json({ status: "ok", group });
}
