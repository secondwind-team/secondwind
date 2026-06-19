import { NextResponse } from "next/server";
import { buildFinzProfile } from "@/lib/common/services/finz";
import { resolveAccount, resolveAuth } from "@/lib/server/finz-account";
import {
  createAccountForAuth,
  isFinzAccountStoreConfigured,
  updateAccount,
} from "@/lib/server/finz-account-store";
import { pushFeedEvent } from "@/lib/server/finz-account-store";

export const runtime = "nodejs";

// 현재 인증 사용자의 FINZ 계정 상태. 클라이언트 게이트가 이걸로 분기한다:
//  anon → 로그인 / needs-onboarding → 온보딩 / ok → 메신저.
export async function GET() {
  if (!isFinzAccountStoreConfigured()) {
    return NextResponse.json({ status: "anon", reason: "store-unconfigured" }, { status: 200 });
  }
  try {
    const r = await resolveAccount();
    if (r.status === "ok") return NextResponse.json({ status: "ok", account: r.account });
    return NextResponse.json({ status: r.status });
  } catch (e) {
    console.error("[finz/account] GET 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

type Body = {
  handle?: unknown;
  displayName?: unknown;
  selectedCardIds?: unknown;
  bio?: unknown;
};

// 온보딩(계정 생성) 또는 프로필 편집(계정 갱신). 같은 인증에 계정이 있으면 갱신, 없으면 생성.
// Google 은 인증만 — 계정/핸들은 FINZ 가 소유한다.
export async function POST(req: Request) {
  if (!isFinzAccountStoreConfigured()) {
    return NextResponse.json({ status: "error", reason: "store-unconfigured" }, { status: 503 });
  }
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ status: "anon" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle : "";
  const displayName = typeof body.displayName === "string" ? body.displayName : "";
  const selectedCardIds = Array.isArray(body.selectedCardIds)
    ? body.selectedCardIds.filter((c): c is string => typeof c === "string")
    : [];
  const bio = typeof body.bio === "string" ? body.bio : "";

  // 캐릭터는 선택 — 계정은 캐릭터 없이도 만들고(온보딩), 캐릭터는 나중에 프로필에서 소환한다.
  // 카드를 골랐다면(>0) 3개 이상이어야 캐릭터가 소환된다. 1~2개만 invalid.
  const hasCharacter = selectedCardIds.length >= 3;
  if (selectedCardIds.length > 0 && !buildFinzProfile(selectedCardIds)) {
    return NextResponse.json({ status: "invalid", reason: "character" }, { status: 400 });
  }

  try {
    const existing = await resolveAccount();
    if (existing.status === "ok") {
      // 프로필 편집(핸들·이름·소개·캐릭터).
      const hadCharacter = existing.account.selectedCardIds.length >= 3;
      const res = await updateAccount(existing.account.accountId, { handle, displayName, selectedCardIds, bio });
      if (res.status === "ok") {
        // 캐릭터를 "처음" 소환했을 때 피드 이벤트(재소환은 스팸 방지로 제외).
        if (!hadCharacter && hasCharacter) {
          void pushFeedEvent({ actorId: res.account.accountId, type: "character_summoned" }).catch(() => {});
        }
        return NextResponse.json({ status: "ok", account: res.account });
      }
      return NextResponse.json({ status: res.status }, { status: res.status === "handle-taken" ? 409 : 400 });
    }

    // 온보딩(계정 생성) — 핸들만으로 충분. 캐릭터는 프로필에서.
    const res = await createAccountForAuth({
      provider: auth.provider,
      providerId: auth.providerId,
      handle,
      displayName,
      selectedCardIds,
      bio,
    });
    if (res.status === "ok") {
      void pushFeedEvent({ actorId: res.account.accountId, type: "account_created" }).catch(() => {});
      if (hasCharacter) {
        void pushFeedEvent({ actorId: res.account.accountId, type: "character_summoned" }).catch(() => {});
      }
      return NextResponse.json({ status: "ok", account: res.account });
    }
    return NextResponse.json({ status: res.status }, { status: res.status === "handle-taken" ? 409 : 400 });
  } catch (e) {
    console.error("[finz/account] POST 실패", e);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
