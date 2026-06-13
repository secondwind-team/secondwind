import { NextResponse } from "next/server";
import { buildFinzGroupMember, isFinzGroupId, joinFinzGroup } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; displayName?: unknown; selectedCardIds?: unknown };

// 파티 합류. 로그인 불필요. 같은 memberId 재합류는 멱등(already-member -> ok).
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
  const displayName = typeof body.displayName === "string" ? body.displayName : undefined;
  const selectedCardIds = Array.isArray(body.selectedCardIds)
    ? body.selectedCardIds.filter((c): c is string => typeof c === "string")
    : [];

  const member = buildFinzGroupMember({ memberId, displayName, selectedCardIds });
  if (!member) {
    return NextResponse.json({ status: "error", reason: "invalid-member" }, { status: 400 });
  }

  const result = await joinFinzGroup(groupId, member);
  if (result.status === "not-found") {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }
  if (result.status === "full") {
    return NextResponse.json({ status: "full", reason: "party-full", group: result.group }, { status: 409 });
  }
  return NextResponse.json({ status: "ok", memberId, group: result.group });
}
