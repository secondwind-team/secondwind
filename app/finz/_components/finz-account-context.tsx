"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { FinzAccount } from "@/lib/common/services/finz-account";

// 클라이언트 계정 상태 — 게이트가 이걸로 로그인/온보딩/메신저를 분기한다.
export type FinzAccountState =
  | { kind: "loading" }
  | { kind: "anon"; reason?: string } // 미로그인(또는 스토어 미설정)
  | { kind: "needs-onboarding" } // 로그인했지만 핸들/캐릭터 미설정
  | { kind: "ok"; account: FinzAccount }
  | { kind: "error" };

type Ctx = {
  state: FinzAccountState;
  refresh: () => Promise<void>;
  setAccount: (account: FinzAccount) => void;
};

const FinzAccountContext = createContext<Ctx | null>(null);

export function FinzAccountProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: FinzAccountState; // 서버에서 SSR 로 미리 해석한 계정 상태(있으면 첫 클라이언트 fetch 생략 → 왕복 1회 절감)
}) {
  const [state, setState] = useState<FinzAccountState>(initialState ?? { kind: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/finz/account", { cache: "no-store" });
      if (res.status === 503) {
        setState({ kind: "error" });
        return;
      }
      const json = (await res.json()) as { status: string; account?: FinzAccount; reason?: string };
      if (json.status === "ok" && json.account) setState({ kind: "ok", account: json.account });
      else if (json.status === "needs-onboarding") setState({ kind: "needs-onboarding" });
      else if (json.status === "anon") setState({ kind: "anon", reason: json.reason });
      else setState({ kind: "error" });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    // SSR 로 이미 해석된 상태가 있으면 첫 fetch 생략(서버가 같은 세션 쿠키로 정확히 해석함).
    // SSR 누락(에러 폴백 등)일 때만 클라이언트가 직접 조회한다.
    if (!initialState) void refresh();
  }, [refresh, initialState]);

  const setAccount = useCallback((account: FinzAccount) => {
    setState({ kind: "ok", account });
  }, []);

  return (
    <FinzAccountContext.Provider value={{ state, refresh, setAccount }}>{children}</FinzAccountContext.Provider>
  );
}

export function useFinzAccountCtx(): Ctx {
  const ctx = useContext(FinzAccountContext);
  if (!ctx) throw new Error("useFinzAccountCtx must be used within FinzAccountProvider");
  return ctx;
}

// 계정이 확정된 화면(탭/방)에서만 호출 — 게이트가 ok 일 때만 자식을 렌더하므로 account 보장.
export function useFinzAccount(): FinzAccount {
  const { state } = useFinzAccountCtx();
  if (state.kind !== "ok") {
    throw new Error("useFinzAccount called before account is ready");
  }
  return state.account;
}
