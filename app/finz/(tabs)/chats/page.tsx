import type { FinzRoomSummary } from "@/lib/common/services/finz-account";
import { requireAccount } from "@/lib/server/finz-account";
import { listRoomsForAccount } from "@/lib/server/finz-room";
import { FinzChatsClient } from "@/app/finz/_components/finz-chats-client";

export const dynamic = "force-dynamic";

// 대화 탭 — 방 목록을 서버(SSR)에서 받아 클라이언트에 시드. (계정 게이트는 상위 레이아웃이 처리.)
// us-east 함수↔서울 사용자 왕복이 비싸므로, 목록 fetch 를 클라이언트가 한 번 더 왕복하지 않게 한다.
export default async function FinzChatsPage() {
  let initialRooms: FinzRoomSummary[] = [];
  try {
    const me = await requireAccount();
    // 계정이 없으면(미로그인·온보딩 전·SSR 장애) 게이트가 어차피 로그인/온보딩을 띄운다.
    // FinzChatsClient(useFinzAccount 가 ok 전제)를 서버에서 만들지 않아 어떤 상태든 게이트와 정합.
    if (!me) return null;
    initialRooms = await listRoomsForAccount(me.accountId);
  } catch {
    return null; // SSR 실패 → 게이트가 처리(클라이언트 폴백/에러)
  }
  return <FinzChatsClient initialRooms={initialRooms} />;
}
