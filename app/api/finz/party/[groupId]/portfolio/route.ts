import { NextResponse } from "next/server";
import { normalizeTrade } from "@/lib/common/services/finz-portfolio";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { addTrade, listTrades } from "@/lib/server/finz-portfolio-store";

export const runtime = "nodejs";

// GET ?memberId= — 방의 거래 목록(설정 화면). 보유 현황은 클라가 순수 모듈로 계산.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  const memberId = new URL(req.url).searchParams.get("memberId") ?? "";

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }
  return NextResponse.json({ status: "ok", trades: await listTrades(groupId) });
}

type CreateBody = {
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

// POST — 설정 화면 폼에서 거래 직접 추가.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  const me = group.members.find((m) => m.memberId === memberId);
  if (!me) return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });

  const normalized = normalizeTrade(body, new Date().toISOString());
  if (!normalized) return NextResponse.json({ status: "error", reason: "invalid-input" }, { status: 422 });

  const added = await addTrade(groupId, { ...normalized, ownerId: memberId, ownerName: me.displayName });
  if (added.status === "limit") return NextResponse.json({ status: "error", reason: "limit" }, { status: 409 });
  if (added.status !== "ok") return NextResponse.json({ status: "error" }, { status: 503 });

  return NextResponse.json({ status: "ok", trade: added.trade, trades: await listTrades(groupId) });
}
