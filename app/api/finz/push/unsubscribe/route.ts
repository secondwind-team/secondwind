import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { deleteSubscription, isFinzPushConfigured } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";

// 현재 기기의 구독을 해제. 본인(account_id 일치) endpoint 만 삭제한다.
export async function POST(req: Request) {
  if (!isFinzPushConfigured()) {
    return NextResponse.json({ status: "error", reason: "push-unconfigured" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = (await req.json()) as { endpoint?: unknown };
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });

  try {
    await deleteSubscription(endpoint, me.accountId);
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[finz/push/unsubscribe] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
