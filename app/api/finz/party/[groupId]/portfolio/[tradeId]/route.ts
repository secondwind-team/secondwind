import { NextResponse } from "next/server";
import { normalizeTrade } from "@/lib/common/services/finz-portfolio";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { deleteTrade, listTrades, updateTrade } from "@/lib/server/finz-portfolio-store";

export const runtime = "nodejs";

type Params = { params: Promise<{ groupId: string; tradeId: string }> };

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
  action?: unknown;
  symbol?: unknown;
  label?: unknown;
  shares?: unknown;
  price?: unknown;
  currency?: unknown;
  scope?: unknown;
  tradedAt?: unknown;
  note?: unknown;
};

// PATCH — 거래 수정(설정 화면). 기존 값에 병합 후 재정규화.
export async function PATCH(req: Request, { params }: Params) {
  const { groupId, tradeId } = await params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const g = await guard(groupId, memberId);
  if (!g.ok) return g.res;

  const existing = (await listTrades(groupId)).find((t) => t.id === tradeId);
  if (!existing) return NextResponse.json({ status: "not-found" }, { status: 404 });

  const merged = {
    action: body.action ?? existing.action,
    symbol: body.symbol ?? existing.symbol,
    label: body.label ?? existing.label,
    shares: body.shares ?? existing.shares,
    price: body.price ?? existing.price,
    currency: body.currency ?? existing.currency,
    scope: body.scope ?? existing.scope,
    tradedAt: body.tradedAt ?? existing.tradedAt,
    note: body.note ?? existing.note,
  };
  const normalized = normalizeTrade(merged, new Date().toISOString());
  if (!normalized) return NextResponse.json({ status: "error", reason: "invalid-input" }, { status: 422 });

  const updated = await updateTrade(groupId, tradeId, normalized);
  if (!updated) return NextResponse.json({ status: "error" }, { status: 503 });
  return NextResponse.json({ status: "ok", trade: updated, trades: await listTrades(groupId) });
}

// DELETE — 거래 삭제(설정 화면).
export async function DELETE(req: Request, { params }: Params) {
  const { groupId, tradeId } = await params;
  let body: { memberId?: unknown } = {};
  try {
    body = (await req.json()) as { memberId?: unknown };
  } catch {
    body = {};
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const g = await guard(groupId, memberId);
  if (!g.ok) return g.res;

  await deleteTrade(groupId, tradeId);
  return NextResponse.json({ status: "ok", trades: await listTrades(groupId) });
}
