import { NextResponse } from "next/server";
import { FINZ_PARTY_STANCES, type FinzPartyStance } from "@/lib/common/services/finz";
import { isFinzGroupId, setFinzGroupPosition } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; stance?: unknown; note?: unknown };

// 멤버 한 줄 포지션 저장(LLM 없음, 즉시). 멤버만 쓸 수 있다(members-guard).
// 주의: memberId 는 위조 가능한 클라이언트 값이고 GET 이 그룹 blob 으로 양쪽 memberId 를 노출하므로,
// 한 멤버가 다른 멤버의 포지션을 덮어쓰는 것은 막지 못한다. 2인 신뢰 파티 기준 수용(payoff 없음).
// 비신뢰/다중 파티로 넓힐 땐 join 시 서버 발급 토큰으로 보강할 것 — 후속 과제.
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
  const stance = body.stance;
  if (typeof stance !== "string" || !(FINZ_PARTY_STANCES as readonly string[]).includes(stance)) {
    return NextResponse.json({ status: "error", reason: "invalid-stance" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note : "";

  const result = await setFinzGroupPosition(groupId, { memberId, stance: stance as FinzPartyStance, note });
  if (result.status === "not-found") return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (result.status === "not-full") return NextResponse.json({ status: "error", reason: "not-full" }, { status: 409 });
  if (result.status === "not-member") return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  return NextResponse.json({ status: "ok", group: result.group });
}
