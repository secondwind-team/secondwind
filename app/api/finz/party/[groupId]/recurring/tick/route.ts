import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { acquireRoomTick, listDueIdsForRoom } from "@/lib/server/finz-recurring-store";
import { processRecurringIds } from "@/lib/server/finz-recurring-runner";
import { getBlockedModels } from "@/lib/server/quota-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown };

// 방별 정기 메시지 tick — 방이 열려 있을 때 클라가 주기적으로 호출(60초 스로틀). 그 방의 due 정기 메시지를 즉시 발송.
// GitHub cron 의 잦은-스케줄 지연/누락을 보완: 누군가 방을 보고 있으면 정시에 가깝게 발송된다. members-guard.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  // 60초 스로틀 — 폴링마다 처리하지 않게. 못 잡으면 최근에 이미 확인함(no-op).
  if (!(await acquireRoomTick(groupId))) {
    return NextResponse.json({ status: "ok", fired: 0, throttled: true });
  }

  const now = Date.now();
  const dueIds = await listDueIdsForRoom(groupId, now);
  if (dueIds.length === 0) return NextResponse.json({ status: "ok", fired: 0 });

  const skipModels = await getBlockedModels();
  const { posted } = await processRecurringIds(dueIds, now, skipModels);
  return NextResponse.json({ status: "ok", fired: posted });
}
