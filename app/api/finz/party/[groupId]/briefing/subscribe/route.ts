import { NextResponse } from "next/server";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { appendAnswerMessage } from "@/lib/server/finz-chat-store";
import {
  MORNING_ECONOMY_BRIEFING_ID,
  subscribeBriefing,
  unsubscribeBriefing,
} from "@/lib/server/finz-briefing-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; subscribe?: unknown };

// @finz 로 "매일 아침 시황" 구독/해지. 멤버만(ask 와 동일 가드). 토글 후 finz 확인 메시지를 방에 남긴다.
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
  const subscribe = body.subscribe !== false; // 기본 구독(대부분 요청이 "받을래")

  const group = await getFinzGroup(groupId);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!group.members.some((m) => m.memberId === memberId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }

  try {
    if (subscribe) {
      await subscribeBriefing(MORNING_ECONOMY_BRIEFING_ID, groupId);
      await appendAnswerMessage(
        groupId,
        "좋아! 매일 아침 9시에 오늘의 경제 시황을 이 방에 정리해서 보내줄게 📈\n\nℹ️ 투자 조언이 아니라 정보 참고용이야.",
      ).catch(() => {});
    } else {
      await unsubscribeBriefing(MORNING_ECONOMY_BRIEFING_ID, groupId);
      await appendAnswerMessage(
        groupId,
        "이제 아침 시황은 안 보낼게. 다시 받고 싶으면 '@finz 아침 시황 보내줘' 라고 해줘.",
      ).catch(() => {});
    }
    return NextResponse.json({ status: "ok", subscribed: subscribe });
  } catch (e) {
    console.error("[finz/briefing/subscribe] 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
