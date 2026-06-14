import { NextResponse } from "next/server";
import { isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendTextMessage } from "@/lib/server/finz-chat-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; text?: unknown; id?: unknown };

// 멤버 자유 텍스트 전송. LLM 절대 안 거침. authorName 은 서버 조회(클라이언트 값 무시),
// 280자/멤버당 레이트 제한은 store 에서. 권위 있는 echo 메시지(실 id)를 돌려줘 클라이언트가
// 낙관적 임시 버블을 id 로 교체한다.
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
  const text = typeof body.text === "string" ? body.text : "";
  const clientId = typeof body.id === "string" ? body.id : undefined;

  const result = await appendTextMessage(groupId, memberId, text, clientId);
  if (result.status === "not-found") return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (result.status === "not-member")
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  if (result.status === "rate-limited")
    return NextResponse.json({ status: "error", reason: "rate-limited" }, { status: 429 });
  if (result.status === "empty")
    return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });

  return NextResponse.json({ status: "ok", message: result.message });
}
