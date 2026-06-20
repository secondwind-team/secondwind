import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/finz-account";
import { isFinzPushConfigured, sendToAccounts } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";

// 본인의 모든 기기로 테스트 알림을 발송. 구독이 없으면 sent:0(에러 아님 — 권한/구독을 먼저 확인하라는 신호).
export async function POST() {
  if (!isFinzPushConfigured()) {
    return NextResponse.json({ status: "error", reason: "push-unconfigured" }, { status: 503 });
  }
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  try {
    const result = await sendToAccounts([me.accountId], {
      title: "FINZ 알림 테스트 🔔",
      body: "알림이 잘 도착했어요! 이제 새 메시지·아침 브리핑을 놓치지 않아요.",
      url: "/finz/profile",
      tag: "finz-test",
    });
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    console.error("[finz/push/test] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
