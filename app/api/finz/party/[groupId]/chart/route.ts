import { NextResponse } from "next/server";
import { normalizeChartSymbol } from "@/lib/common/services/finz-chat";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendChartMessage } from "@/lib/server/finz-chat-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; symbol?: unknown; label?: unknown };

// @finz 차트 요청 → chart 메시지 append(렌더는 클라가 TradingView 위젯으로). 멤버만(ask 와 동일 가드).
// 심볼은 normalizeChartSymbol 로 정규화(허용 외 문자 제거) — 위젯에 안전한 값만 저장. LLM·자유텍스트가
// 직접 닿지 않고 정규화된 심볼만 들어간다. 실제 시세 데이터는 TradingView 가 제공(환각 없음).
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const symbol = normalizeChartSymbol(body.symbol);
  if (!symbol) return NextResponse.json({ status: "error", reason: "invalid-symbol" }, { status: 400 });
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : symbol;

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  const appended = await appendChartMessage(groupId, symbol, label || symbol);
  if (appended.status !== "ok" || !appended.message) {
    return NextResponse.json({ status: "error", reason: "append-failed" }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", message: appended.message });
}
