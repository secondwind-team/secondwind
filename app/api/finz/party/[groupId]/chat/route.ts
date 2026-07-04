import { NextResponse } from "next/server";
import { MAX_MEMBERS, getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { getChatTail } from "@/lib/server/finz-chat-store";
import { requireAccount } from "@/lib/server/finz-account";

export const runtime = "nodejs";
// 폴링이 항상 최신 꼬리를 받도록 캐시를 끈다.
export const dynamic = "force-dynamic";

// 라이브 폴링 엔드포인트. ?after=<seq> 이후 메시지만(오름차순) + 멤버 + cursor.
// ?rev=<n> 보다 서버 revision 이 크면 과거 메시지 반응/수정/삭제가 바뀐 것이므로 전체 창을 다시 보낸다.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  // 읽기도 멤버만 — 비멤버가 그룹 ID 만으로 대화·포트폴리오·입장을 열람하지 못하게(쓰기 가드와 동일 원칙).
  // memberId=accountId 라 세션으로 검증한다(폴링 fetch 가 쿠키를 자동 전송 → 클라 변경 불필요).
  // 비멤버 클라는 애초에 폴링하지 않고(join-view), 합류 후 멤버가 되면 폴링이 통과한다.
  // 가장 빈번한 폴링 경로라 그룹(Redis 도쿄)·계정(Neon 싱가포르) 조회를 병렬로 묶어 cross-region 왕복이
  // 직렬로 쌓이지 않게 한다. (accountId 를 세션 클레임으로 옮겨 Neon 조회 자체를 없애는 건 후속 과제.)
  const [group, account] = await Promise.all([getFinzGroup(groupId), requireAccount()]);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!account || !group.members.some((m) => m.memberId === account.accountId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  // after 방어적 파싱: NaN/음수면 전체 꼬리(seq 0 환영 메시지가 가려지지 않게).
  const search = new URL(req.url).searchParams;
  const raw = search.get("after");
  const n = Number(raw);
  const after = Number.isFinite(n) ? n : -1;
  const rawRev = search.get("rev");
  const clientRev = Number(rawRev);

  const peek = await getChatTail(groupId, after < 0 ? -1 : after);
  const forceAll = Number.isFinite(clientRev) && clientRev >= 0 && peek.revision > clientRev;
  const tail = forceAll ? await getChatTail(groupId, -1, true) : peek;

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
    revision: tail.revision,
    chatMode: group.chatMode, // 대화 방식 — 토글이 폴링(~3s)으로 전 멤버에 전파(리로드 불필요)
    expiresAt: group.expiresAt,
  });
}
