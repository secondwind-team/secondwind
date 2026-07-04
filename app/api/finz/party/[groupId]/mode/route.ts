import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
import { getFinzGroup, isFinzGroupId, setFinzGroupChatMode } from "@/lib/server/finz-group-store";
import type { FinzChatMode } from "@/lib/common/services/finz-chat";

export const runtime = "nodejs";

type Body = { mode?: unknown };

// 방 대화 방식(일반 linear / 스레드 thread) 전환. 방 단위 설정(전 멤버 공유)이라 계정은 세션에서 도출하고
// (클라 accountId 불신) 멤버만 허용한다(mute 는 per-account 라 가드 불필요했지만, 이건 공유 상태라 필수).
// 초기 상태는 설정/방 페이지가 SSR 로 group.chatMode 를 시드 → GET 불필요. 전파는 chat 폴링(chatMode)로.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  if (!isFinzAccountStoreConfigured()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const mode: FinzChatMode | null =
    body.mode === "thread" ? "thread" : body.mode === "linear" ? "linear" : null;
  if (!mode) return NextResponse.json({ status: "error", reason: "invalid-mode" }, { status: 400 });

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === me.accountId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  try {
    const result = await setFinzGroupChatMode(groupId, mode);
    if (result.status !== "ok") return NextResponse.json({ status: "not-found" }, { status: 404 });
    return NextResponse.json({ status: "ok", mode });
  } catch (e) {
    console.error("[finz/party/mode] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
