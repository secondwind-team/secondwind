// 서버 전용: NextAuth 세션 → FINZ 계정 resolve. 민감 라우트(계정/친구/피드/방생성/초대)는
// 클라이언트가 보낸 accountId 를 신뢰하지 않고 여기서 세션으로부터 계정을 도출한다.
//
// Google 은 "인증 제공자"일 뿐 — provider="google", providerId=google sub 으로 authlink 를 찾는다.
// 나중에 다른 provider 를 붙여도 이 함수 시그니처는 그대로(authlink 한 줄 추가).

import type { FinzAccount } from "@/lib/common/services/finz-account";
import { getCurrentUser } from "@/lib/server/auth";
import { getAccountForAuth } from "@/lib/server/finz-account-store";

export type ResolvedAuth = { provider: string; providerId: string; email: string; name: string | null };

// 현재 로그인 사용자의 인증 신원(계정 유무와 무관). 미로그인이면 null.
export async function resolveAuth(): Promise<ResolvedAuth | null> {
  const user = await getCurrentUser();
  if (!user || !user.id) return null;
  return { provider: "google", providerId: user.id, email: user.email, name: user.name ?? null };
}

export type AccountResolution =
  | { status: "anon" }
  | { status: "needs-onboarding"; auth: ResolvedAuth }
  | { status: "ok"; auth: ResolvedAuth; account: FinzAccount };

export async function resolveAccount(): Promise<AccountResolution> {
  const auth = await resolveAuth();
  if (!auth) return { status: "anon" };
  const account = await getAccountForAuth(auth.provider, auth.providerId);
  if (!account) return { status: "needs-onboarding", auth };
  return { status: "ok", auth, account };
}

// 보호 라우트용 — 계정이 있으면 반환, 아니면 null(라우트가 401/409 로 변환).
export async function requireAccount(): Promise<FinzAccount | null> {
  const r = await resolveAccount();
  return r.status === "ok" ? r.account : null;
}
