import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
import { setRoomMute } from "@/lib/server/finz-push-store";
import { isFinzGroupId } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

type Body = { muted?: unknown; allowMentions?: unknown };

// 내 방 알림 음소거 설정 저장. 계정은 세션에서 도출(클라 accountId 불신).
// muted=true 면 이 방 알림 끔. allowMentions(기본 true)면 음소거여도 @표시이름 멘션은 예외로 받음.
// 초기 상태는 설정 페이지가 SSR 로 getRoomMute 조회 → GET 라우트 불필요.
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
  const muted = body.muted === true;
  const allowMentions = body.allowMentions !== false; // 미지정 시 기본 true(멘션은 받음)

  try {
    await setRoomMute(me.accountId, groupId, { muted, allowMentions });
    return NextResponse.json({ status: "ok", muted, allowMentions });
  } catch (e) {
    console.error("[finz/party/mute] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
