import { NextResponse } from "next/server";
import { isKstMonthEnd } from "@/lib/common/services/finz-monthly-review";
import { runFinzMonthlyReview } from "@/lib/server/finz-monthly-review-runner";
import {
  listFinzMonthlyReviewRooms,
  unsubscribeFinzMonthlyReview,
} from "@/lib/server/finz-monthly-review-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROOMS_PER_RUN = 50;

// 매일 KST 12:00에 호출하되 실제 리뷰는 말일에만 생성한다. CRON_SECRET은 다른 FINZ cron과 공유한다.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[finz/cron/monthly-review] CRON_SECRET 미설정 — 비활성");
    return NextResponse.json({ status: "error", reason: "unconfigured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", reason: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isKstMonthEnd(now)) {
    return NextResponse.json({ status: "ok", skipped: true, reason: "not-kst-month-end" });
  }

  const roomIds = await listFinzMonthlyReviewRooms(MAX_ROOMS_PER_RUN);
  const results: Array<{ roomId: string; status: string }> = [];
  for (const roomId of roomIds) {
    try {
      const result = await runFinzMonthlyReview({
        roomId,
        kind: "scheduled-monthly",
        requestedAt: now.toISOString(),
      });
      results.push({ roomId, status: result.status });
      if (result.status === "not-found") {
        await unsubscribeFinzMonthlyReview(roomId);
      }
    } catch (error) {
      console.warn(`[finz/cron/monthly-review] 방 ${roomId} 리뷰 실패`, error);
      results.push({ roomId, status: "error" });
    }
  }

  return NextResponse.json({ status: "ok", checkedAt: now.toISOString(), results });
}
