import { NextResponse } from "next/server";
import { normalizeRecurringInput } from "@/lib/common/services/finz-recurring";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import {
  deleteRecurring,
  getRecurring,
  listRecurringForRoom,
  updateRecurring,
} from "@/lib/server/finz-recurring-store";

export const runtime = "nodejs";

type Params = { params: Promise<{ groupId: string; recurringId: string }> };

async function guard(groupId: string, memberId: string) {
  if (!isFinzGroupId(groupId)) return { ok: false as const, res: NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 }) };
  const group = await getFinzGroup(groupId);
  if (!group) return { ok: false as const, res: NextResponse.json({ status: "not-found" }, { status: 404 }) };
  if (!group.members.some((m) => m.memberId === memberId)) {
    return { ok: false as const, res: NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 }) };
  }
  return { ok: true as const };
}

type PatchBody = {
  memberId?: unknown;
  enabled?: unknown;
  content?: unknown;
  contentKind?: unknown;
  freq?: unknown;
  hour?: unknown;
  minute?: unknown;
  weekday?: unknown;
  intervalMinutes?: unknown;
};

// PATCH — 정기 메시지 수정(설정 화면). enabled 토글만, 또는 내용·스케줄 전체 수정.
export async function PATCH(req: Request, { params }: Params) {
  const { groupId, recurringId } = await params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const g = await guard(groupId, memberId);
  if (!g.ok) return g.res;

  const existing = await getRecurring(recurringId);
  if (!existing || existing.roomId !== groupId) {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }

  // enabled 만 바꾸는 토글이면 가볍게.
  const onlyToggle =
    typeof body.enabled === "boolean" &&
    body.content === undefined &&
    body.freq === undefined &&
    body.hour === undefined &&
    body.minute === undefined &&
    body.weekday === undefined &&
    body.intervalMinutes === undefined &&
    body.contentKind === undefined;

  if (onlyToggle) {
    const updated = await updateRecurring(groupId, recurringId, { enabled: body.enabled as boolean }, Date.now());
    if (!updated) return NextResponse.json({ status: "error" }, { status: 503 });
    return NextResponse.json({ status: "ok", def: updated, items: await listRecurringForRoom(groupId) });
  }

  // 내용/스케줄 수정 — 기존 값을 베이스로 병합해 정규화(부분 수정 허용).
  const merged = {
    contentKind: body.contentKind ?? existing.contentKind,
    content: body.content ?? existing.content,
    freq: body.freq ?? existing.freq,
    hour: body.hour ?? existing.hour,
    minute: body.minute ?? existing.minute,
    weekday: body.weekday ?? existing.weekday,
    intervalMinutes: body.intervalMinutes ?? existing.intervalMinutes,
  };
  const normalized = normalizeRecurringInput(merged);
  if (!normalized) {
    return NextResponse.json({ status: "error", reason: "invalid-input" }, { status: 422 });
  }

  const patch = {
    contentKind: normalized.contentKind,
    content: normalized.content,
    freq: normalized.freq,
    hour: normalized.hour,
    minute: normalized.minute,
    weekday: normalized.weekday,
    intervalMinutes: normalized.intervalMinutes,
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
  };
  const updated = await updateRecurring(groupId, recurringId, patch, Date.now());
  if (!updated) return NextResponse.json({ status: "error" }, { status: 503 });
  return NextResponse.json({ status: "ok", def: updated, items: await listRecurringForRoom(groupId) });
}

type DeleteBody = { memberId?: unknown };

// DELETE — 정기 메시지 삭제(설정 화면).
export async function DELETE(req: Request, { params }: Params) {
  const { groupId, recurringId } = await params;
  let body: DeleteBody = {};
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    body = {};
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const g = await guard(groupId, memberId);
  if (!g.ok) return g.res;

  await deleteRecurring(groupId, recurringId);
  return NextResponse.json({ status: "ok", items: await listRecurringForRoom(groupId) });
}
