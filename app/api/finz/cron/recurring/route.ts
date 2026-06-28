import { NextResponse } from "next/server";
import { listDueRecurring } from "@/lib/server/finz-recurring-store";
import { processRecurringIds } from "@/lib/server/finz-recurring-runner";
import { getBlockedModels } from "@/lib/server/quota-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 정기 메시지 cron — GitHub Actions(약 10분 간격)가 Bearer 토큰으로 호출(브리핑 cron 과 동일 패턴·동일 CRON_SECRET).
// 전역 due ZSET 의 발송 예정 지난 정기 메시지를 처리. ※ GitHub 의 잦은 cron 은 지연/누락이 잦으므로, 열린 방은
// 클라가 호출하는 /recurring/tick 이 즉시 발송하고 이 cron 은 "닫힌 방까지 챙기는" 백업 역할(같은 runner·중복방지).
const MAX_PER_RUN = 50;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[finz/cron/recurring] CRON_SECRET 미설정 — 비활성");
    return NextResponse.json({ status: "error", reason: "unconfigured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", reason: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const dueIds = await listDueRecurring(now, MAX_PER_RUN);
  if (dueIds.length === 0) {
    return NextResponse.json({ status: "ok", posted: 0, reason: "none-due" });
  }
  const skipModels = await getBlockedModels();
  const { posted, skipped } = await processRecurringIds(dueIds, now, skipModels);
  return NextResponse.json({ status: "ok", posted, skipped, due: dueIds.length });
}
