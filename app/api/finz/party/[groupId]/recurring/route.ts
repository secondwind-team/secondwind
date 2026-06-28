import { NextResponse } from "next/server";
import { describeRecurring, normalizeRecurringInput } from "@/lib/common/services/finz-recurring";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendAnswerMessage } from "@/lib/server/finz-chat-store";
import { createRecurring, listRecurringForRoom } from "@/lib/server/finz-recurring-store";

export const runtime = "nodejs";

// GET ?memberId= — 방의 정기 메시지 목록(설정 화면 새로고침용). members-guard.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }
  const memberId = new URL(req.url).searchParams.get("memberId") ?? "";

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  const items = await listRecurringForRoom(groupId);
  return NextResponse.json({ status: "ok", items });
}

type CreateBody = {
  memberId?: unknown;
  contentKind?: unknown;
  content?: unknown;
  freq?: unknown;
  hour?: unknown;
  minute?: unknown;
  weekday?: unknown;
  intervalMinutes?: unknown;
};

// POST — 설정 화면의 폼에서 구조화 입력으로 정기 메시지 등록. members-guard. 등록 후 방에 finz 확인 메시지.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const memberId = typeof body.memberId === "string" ? body.memberId : "";

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  const normalized = normalizeRecurringInput(body);
  if (!normalized) {
    return NextResponse.json({ status: "error", reason: "invalid-input" }, { status: 422 });
  }

  const created = await createRecurring({ roomId: groupId, createdBy: memberId, normalized, nowMs: Date.now() });
  if (created.status === "limit") {
    return NextResponse.json({ status: "error", reason: "limit" }, { status: 409 });
  }
  if (created.status !== "ok") {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  await appendAnswerMessage(
    groupId,
    `좋아! 앞으로 ${describeRecurring(created.def)} 보내줄게 ⏰\n채팅방 설정에서 언제든 보고 수정·삭제할 수 있어.`,
  ).catch(() => {});

  const items = await listRecurringForRoom(groupId);
  return NextResponse.json({ status: "ok", def: created.def, items });
}
