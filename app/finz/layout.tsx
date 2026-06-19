import type { Metadata } from "next";
import "./finz-theme.css";
import { FinzAccountProvider } from "./_components/finz-account-context";
import { FinzAppGate } from "./_components/finz-app-gate";

export const metadata: Metadata = {
  title: "FINZ",
  description: "친구랑 편하게 투자 수다 떠는 메신저. 캐릭터·우정주·AI 와 함께.",
};

// FINZ 전용 셸 — secondwind 공용 nav 를 상속하지 않는다. 자체 테마/폰트.
// 메신저 전체를 계정 게이트로 감싼다: 로그인 → 온보딩(핸들·캐릭터) → 4탭 메신저.
// 상단 헤더/하단 탭바는 (tabs) 레이아웃이, 방 화면은 자체 헤더를 갖는다(여긴 풀하이트 컨테이너만).
export default function FinzLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finz-root">
      <main className="mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col">
        <FinzAccountProvider>
          <FinzAppGate>{children}</FinzAppGate>
        </FinzAccountProvider>
      </main>
    </div>
  );
}
