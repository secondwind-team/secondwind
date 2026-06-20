import type { Metadata } from "next";
import "./finz-theme.css";
import { FinzAccountProvider, type FinzAccountState } from "./_components/finz-account-context";
import { FinzAppGate } from "./_components/finz-app-gate";
import { FinzPushRegister } from "./_components/finz-push-register";
import { resolveAccount } from "@/lib/server/finz-account";
import { isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";

export const metadata: Metadata = {
  title: "FINZ",
  description: "친구랑 편하게 투자 수다 떠는 메신저. 캐릭터·우정주·AI 와 함께.",
};

// 세션을 읽어 계정을 SSR 로 해석하므로 per-request 동적 렌더.
export const dynamic = "force-dynamic";

// 서버에서 같은 세션 쿠키로 계정 상태를 미리 해석 → 클라이언트 첫 fetch(왕복) 생략.
// (us-east 함수↔서울 사용자 왕복이 비싸므로 round-trip 1회를 줄이는 게 체감 큼.)
async function getInitialAccountState(): Promise<FinzAccountState | undefined> {
  if (!isFinzAccountStoreConfigured()) return { kind: "anon", reason: "store-unconfigured" };
  try {
    const r = await resolveAccount();
    if (r.status === "ok") return { kind: "ok", account: r.account };
    if (r.status === "needs-onboarding") return { kind: "needs-onboarding" };
    return { kind: "anon" };
  } catch {
    return undefined; // SSR 실패 시 클라이언트 fetch 로 폴백
  }
}

// FINZ 전용 셸 — secondwind 공용 nav 를 상속하지 않는다. 자체 테마/폰트.
// 메신저 전체를 계정 게이트로 감싼다: 로그인 → 온보딩(핸들) → 4탭 메신저.
export default async function FinzLayout({ children }: { children: React.ReactNode }) {
  const initialState = await getInitialAccountState();
  return (
    <div className="finz-root">
      <main className="mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col">
        <FinzAccountProvider initialState={initialState}>
          <FinzPushRegister />
          <FinzAppGate>{children}</FinzAppGate>
        </FinzAccountProvider>
      </main>
    </div>
  );
}
