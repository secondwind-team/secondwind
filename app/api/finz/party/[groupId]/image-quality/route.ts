import { NextResponse } from "next/server";
import { isFinzImageQuality } from "@/lib/common/services/finz-chat";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";
import { getFinzGroup, isFinzGroupId, setFinzGroupImageQuality } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

type Body = { quality?: unknown };

// 방 이미지 업로드 화질(원본/표준/저용량) 전환. 방 단위 설정(전 멤버 공유)이라 계정은 세션에서 도출하고
// 멤버만 허용한다. 초기 상태는 설정/방 페이지가 SSR 로 group.imageQuality 시드, 전파는 chat 폴링으로.
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
  if (!isFinzImageQuality(body.quality)) {
    return NextResponse.json({ status: "error", reason: "invalid-quality" }, { status: 400 });
  }

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === me.accountId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  try {
    const result = await setFinzGroupImageQuality(groupId, body.quality);
    if (result.status !== "ok") return NextResponse.json({ status: "not-found" }, { status: 404 });
    return NextResponse.json({ status: "ok", quality: body.quality });
  } catch (e) {
    console.error("[finz/party/image-quality] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
