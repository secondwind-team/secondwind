import { NextResponse } from "next/server";
import { isFinzReactionEmoji } from "@/lib/common/services/finz-chat";
import { editTextMessage, setMessageReaction, softDeleteMessage } from "@/lib/server/finz-chat-store";
import { isFinzGroupId } from "@/lib/server/finz-group-store";

export const runtime = "nodejs";

type Body = {
  memberId?: unknown;
  action?: unknown;
  emoji?: unknown;
  text?: unknown;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string; messageId: string }> }) {
  const { groupId, messageId } = await params;
  if (!isFinzGroupId(groupId) || !messageId) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "react") {
    const emoji = body.emoji == null ? null : isFinzReactionEmoji(body.emoji) ? body.emoji : "invalid";
    if (emoji === "invalid") return NextResponse.json({ status: "error", reason: "invalid-emoji" }, { status: 400 });
    const result = await setMessageReaction(groupId, memberId, messageId, emoji);
    return mutationResponse(result);
  }

  if (action === "edit") {
    const text = typeof body.text === "string" ? body.text : "";
    const result = await editTextMessage(groupId, memberId, messageId, text);
    return mutationResponse(result);
  }

  if (action === "delete") {
    const result = await softDeleteMessage(groupId, memberId, messageId);
    return mutationResponse(result);
  }

  return NextResponse.json({ status: "error", reason: "unknown-action" }, { status: 400 });
}

function mutationResponse(result: Awaited<ReturnType<typeof setMessageReaction>> | Awaited<ReturnType<typeof editTextMessage>>) {
  if (result.status === "ok") {
    return NextResponse.json({ status: "ok", message: result.message, revision: result.revision });
  }
  if (result.status === "not-found") return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (result.status === "not-member") return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  if (result.status === "empty") return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });
  return NextResponse.json({ status: "error", reason: result.status }, { status: 400 });
}
