import { NextResponse } from "next/server";
import type { FinzAccount } from "@/lib/common/services/finz-account";
import { requireAccount } from "@/lib/server/finz-account";
import {
  getAccountByHandle,
  getFriendsView,
  isFinzAccountStoreConfigured,
  requestFriendByHandle,
  respondToFriendRequest,
} from "@/lib/server/finz-account-store";
import { isFinzPushConfigured, sendToAccounts } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";

function configured() {
  return isFinzAccountStoreConfigured();
}

// 친구 목록 + 받은/보낸 요청.
export async function GET() {
  if (!configured()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });
  try {
    const view = await getFriendsView(me.accountId);
    return NextResponse.json({ status: "ok", ...view });
  } catch (e) {
    console.error("[finz/friends] GET 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

// 핸들로 친구 추가(요청). 상대가 이미 나를 요청했으면 즉시 친구가 된다.
export async function POST(req: Request) {
  if (!configured()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: { handle?: unknown };
  try {
    body = (await req.json()) as { handle?: unknown };
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const handle = typeof body.handle === "string" ? body.handle : "";
  if (!handle) return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });

  try {
    const res = await requestFriendByHandle(me.accountId, handle);
    if (res.status === "ok") {
      // 요청/상호수락을 대상 계정에 푸시(best-effort).
      void notifyFriendRequest(handle, me, res.state).catch(() => {});
      return NextResponse.json({ status: "ok", state: res.state });
    }
    const code = res.status === "not-found" ? 404 : 409;
    return NextResponse.json({ status: res.status }, { status: code });
  } catch (e) {
    console.error("[finz/friends] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

// 받은 요청 수락/거절.
export async function PATCH(req: Request) {
  if (!configured()) return NextResponse.json({ status: "error" }, { status: 503 });
  const me = await requireAccount();
  if (!me) return NextResponse.json({ status: "needs-account" }, { status: 401 });

  let body: { accountId?: unknown; accept?: unknown };
  try {
    body = (await req.json()) as { accountId?: unknown; accept?: unknown };
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }
  const otherId = typeof body.accountId === "string" ? body.accountId : "";
  const accept = body.accept === true;
  if (!otherId) return NextResponse.json({ status: "error", reason: "empty" }, { status: 400 });

  try {
    const res = await respondToFriendRequest(me.accountId, otherId, accept);
    if (res.status === "ok") return NextResponse.json({ status: "ok" });
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  } catch (e) {
    console.error("[finz/friends] PATCH 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

// 친구 요청/상호수락을 대상 계정의 모든 기기로 푸시. state 로 문구를 분기한다.
async function notifyFriendRequest(handle: string, me: FinzAccount, state: "requested" | "accepted"): Promise<void> {
  if (!isFinzPushConfigured()) return;
  const target = await getAccountByHandle(handle);
  if (!target) return;
  const accepted = state === "accepted";
  await sendToAccounts([target.accountId], {
    title: accepted ? "친구가 됐어요 🎉" : "새 친구 요청 👋",
    body: accepted ? `@${me.handle}님과 친구가 됐어요.` : `@${me.handle}님이 친구 요청을 보냈어요.`,
    url: "/finz/friends",
    tag: "finz-friend",
  });
}
