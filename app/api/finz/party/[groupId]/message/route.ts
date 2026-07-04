import { NextResponse } from "next/server";
import { finzMessageSnippet, mentionsMember } from "@/lib/common/services/finz-chat";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendTextMessage } from "@/lib/server/finz-chat-store";
import { getRoomMutesForAccounts, isFinzPushConfigured, sendToAccounts } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; text?: unknown; id?: unknown; replyToId?: unknown; attachments?: unknown };

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
  const replyToId = typeof body.replyToId === "string" ? body.replyToId : undefined;
  const attachments = body.attachments; // 서버(store)에서 Blob URL·개수·용량 재검증

  const result = await appendTextMessage(groupId, memberId, text, clientId, replyToId, attachments);
  if (result.status === "not-found") return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (result.status === "not-member")
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  if (result.status === "rate-limited")
    return NextResponse.json({ status: "error", reason: "rate-limited" }, { status: 429 });
  if (result.status === "empty")
    return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });

  // 저장 성공 → 방의 다른 멤버 전원에게 푸시(best-effort — 저장 응답을 막지 않는다).
  // 미리보기는 저장된 메시지 기준(첨부만 있으면 "📷 사진" 등), 멘션 예외 판정은 원문 캡션 기준.
  const preview = result.message ? finzMessageSnippet(result.message, 80) : text;
  void notifyRoomMembers(groupId, memberId, text, preview).catch(() => {});
  return NextResponse.json({ status: "ok", message: result.message });
}

// 새 멤버 메시지를 방의 다른 멤버(발신자 제외) 모든 기기로 푸시.
// 대상은 group.members(서버 진실)에서 도출하므로 memberId 위조와 무관하다. self 방·혼자면 0명.
// text=원문 캡션(멘션 예외 판정용), preview=푸시 본문 표시용(첨부만 있으면 "📷 사진" 등).
async function notifyRoomMembers(groupId: string, senderId: string, text: string, preview: string): Promise<void> {
  if (!isFinzPushConfigured()) return;
  const group = await getFinzGroup(groupId);
  if (!group) return;
  const others = group.members.filter((m) => m.memberId !== senderId);
  if (others.length === 0) return;

  // 방 음소거 필터 — 음소거한 수신자는 제외. 단 "멘션 예외" ON 이고 그를 @표시이름으로 멘션했으면 포함.
  let recipients: string[];
  try {
    const mutes = await getRoomMutesForAccounts(groupId, others.map((m) => m.memberId));
    recipients = others
      .filter((m) => {
        const mute = mutes.get(m.memberId);
        if (!mute || !mute.muted) return true; // 음소거 안 함 → 받음
        return mute.allowMentions && mentionsMember(text, m.displayName); // 음소거지만 멘션 예외
      })
      .map((m) => m.memberId);
  } catch {
    // mute 조회 실패 → 전체 발송(알림 누락보다 과발송이 안전).
    recipients = others.map((m) => m.memberId);
  }
  if (recipients.length === 0) return;

  const senderName = group.members.find((m) => m.memberId === senderId)?.displayName ?? "친구";
  const isGroup = group.kind === "group" && group.title.length > 0;
  await sendToAccounts(recipients, {
    title: isGroup ? group.title : senderName,
    body: isGroup ? `${senderName}: ${preview}` : preview,
    url: `/finz/party/${groupId}`,
    tag: `finz-room-${groupId}`,
  });
}
