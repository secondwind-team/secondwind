import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzPushConfigured, upsertSubscription } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";

type Body = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
};

// 현재 기기의 푸시 구독을 저장(재구독 시 upsert). 계정은 세션에서 도출 — 클라가 보낸 accountId 는 신뢰하지 않는다.
export async function POST(req: Request) {
  if (!isFinzPushConfigured()) {
    return NextResponse.json({ status: "error", reason: "push-unconfigured" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ status: "error", reason: "invalid-subscription" }, { status: 400 });
  }

  try {
    // user-agent 는 기기 구분용 메타(클라 입력 아님 — 헤더에서 서버가 읽음).
    const userAgent = req.headers.get("user-agent");
    await upsertSubscription({ accountId: me.accountId, endpoint, p256dh, auth, userAgent });
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[finz/push/subscribe] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
