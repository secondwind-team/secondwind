import { NextResponse } from "next/server";
import { buildFinzGroupMember, createFinzGroup } from "@/lib/server/finz-group-store";
import { appendSystemMessage } from "@/lib/server/finz-chat-store";

export const runtime = "nodejs";

type Body = { memberId?: unknown; displayName?: unknown; selectedCardIds?: unknown };

// 파티 생성. 로그인 불필요 — getCurrentUser 를 호출하지 않는다. memberId 는 클라이언트가 만든 값.
export async function POST(req: Request) {
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

  try {
    const result = await createFinzGroup(member);
    if (!result) {
      return NextResponse.json(
        { status: "not-configured", reason: "KV_REST_API_URL 또는 KV_REST_API_TOKEN 이 없습니다." },
        { status: 503 },
      );
    }
    // 환영 시스템 라인은 best-effort — 시드 실패가 create 를 막지 않는다(빈 방은 ephemeral nudge 가 커버).
    try {
      await appendSystemMessage(result.id, "파티를 만들었어! 친구를 초대하면 둘의 조합으로 우정주를 뽑아줄게.");
    } catch {
      // 무시
    }

    return NextResponse.json({
      status: "ok",
      id: result.id,
      url: `/finz/party/${result.id}`,
      memberId,
      expiresAt: result.group.expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", reason: err instanceof Error ? err.message : "party-create-failed" },
      { status: 500 },
    );
  }
}
