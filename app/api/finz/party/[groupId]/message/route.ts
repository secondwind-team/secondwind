import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendTextMessage } from "@/lib/server/finz-chat-store";
import { isFinzPushConfigured, sendToAccounts } from "@/lib/server/finz-push-store";

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

  // 저장 성공 → 방의 다른 멤버 전원에게 푸시(best-effort — 저장 응답을 막지 않는다).
  void notifyRoomMembers(groupId, memberId, text).catch(() => {});
  return NextResponse.json({ status: "ok", message: result.message });
}

// 새 멤버 메시지를 방의 다른 멤버(발신자 제외) 모든 기기로 푸시.
// 대상은 group.members(서버 진실)에서 도출하므로 memberId 위조와 무관하다. self 방·혼자면 0명.
async function notifyRoomMembers(groupId: string, senderId: string, text: string): Promise<void> {
  if (!isFinzPushConfigured()) return;
  const group = await getFinzGroup(groupId);
  if (!group) return;
  const recipients = group.members.filter((m) => m.memberId !== senderId).map((m) => m.memberId);
  if (recipients.length === 0) return;
  const senderName = group.members.find((m) => m.memberId === senderId)?.displayName ?? "친구";
  const isGroup = group.kind === "group" && group.title.length > 0;
  const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;
  await sendToAccounts(recipients, {
    title: isGroup ? group.title : senderName,
    body: isGroup ? `${senderName}: ${preview}` : preview,
    url: `/finz/party/${groupId}`,
    tag: `finz-room-${groupId}`,
  });
}
