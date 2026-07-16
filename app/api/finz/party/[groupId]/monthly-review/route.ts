import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { runFinzMonthlyReview } from "@/lib/server/finz-monthly-review-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { memberId?: unknown };

// 사용자가 현재 방에서 요청하는 중간 월간 리뷰. 정기 리뷰의 가격 기준선은 갱신하지 않는다.
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
  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((member) => member.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  try {
    const result = await runFinzMonthlyReview({ roomId: groupId, kind: "manual-interim" });
    if (result.status === "busy") {
      return NextResponse.json({ status: "ok", deduped: true });
    }
    if (result.status === "not-found") {
      return NextResponse.json({ status: "not-found" }, { status: 404 });
    }
    if (result.status !== "ok") {
      return NextResponse.json({ status: "error", reason: result.status }, { status: 503 });
    }
    return NextResponse.json({ status: "ok", review: result.review });
  } catch (error) {
    console.warn("[finz/monthly-review] 생성 실패", error);
    return NextResponse.json({ status: "error", reason: "review-failed" }, { status: 503 });
  }
}
