import type { Metadata } from "next";
import Link from "next/link";
import "./finz-theme.css";

export const metadata: Metadata = {
  title: "FINZ",
  description: "친구들과 오늘 이야기할 우정주를 찾는 게임형 투자 대화 실험.",
};

// FINZ 전용 셸 — secondwind 공용 nav 를 상속하지 않는다. 자체 테마/폰트/앱바.
export default function FinzLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finz-root">
      <header className="sticky top-0 z-20 border-b border-[var(--fz-line)] bg-[var(--fz-bg)]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
          <Link href="/finz" className="fz-display flex items-center gap-2 text-xl text-[var(--fz-ink)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--fz-coral)]" aria-hidden />
            FINZ
          </Link>
          <Link href="/" className="text-xs font-medium text-[var(--fz-muted)] transition hover:text-[var(--fz-coral-ink)]">
            secondwind ↗
          </Link>
        </div>
      </header>
      {/* flex-1 min-h-0 로 남은 높이를 채워 채팅방이 정확히 (뷰포트 - 헤더) 높이를 갖게 한다.
          매직넘버 calc 없음(폰트 로드에 강건). 패딩은 각 페이지가 직접 갖는다(채팅방은 풀블리드). */}
      <main className="mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col">{children}</main>
    </div>
  );
}
