"use client";

import { useFinzAccountCtx } from "./finz-account-context";
import { FinzLoginView } from "./finz-login-view";
import { FinzOnboarding } from "./finz-onboarding";

// 메신저 진입 게이트: 로딩 / 미로그인 / 온보딩 / 에러 / 정상(자식 렌더)으로 분기.
// ok 일 때만 자식(탭·방)이 마운트되므로 그 안에선 계정이 항상 존재한다(useFinzAccount).
export function FinzAppGate({ children }: { children: React.ReactNode }) {
  const { state, setAccount, refresh } = useFinzAccountCtx();

  if (state.kind === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-[var(--fz-muted)]">
        핀즈를 여는 중…
      </div>
    );
  }
  if (state.kind === "anon") {
    return <FinzLoginView unconfigured={state.reason === "store-unconfigured"} />;
  }
  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-sm text-[var(--fz-muted)]">연결이 잠깐 끊겼어요.</p>
        <button type="button" onClick={() => void refresh()} className="fz-btn fz-btn--ghost">
          다시 시도
        </button>
      </div>
    );
  }
  if (state.kind === "needs-onboarding") {
    return <FinzOnboarding onDone={setAccount} />;
  }
  return <>{children}</>;
}
