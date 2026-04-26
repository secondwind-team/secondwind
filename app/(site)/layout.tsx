import Link from "next/link";
import { GlobalFeedback } from "./_components/global-feedback";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <header className="mb-8 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <Link href="/" className="text-base font-semibold tracking-tight text-[var(--ink)]">
          secondwind
        </Link>
        <nav className="text-sm text-[var(--muted)]">
          <Link href="/travel" className="rounded-xl px-3 py-1.5 transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]">
            travel
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="pt-16 text-xs text-[var(--muted)]">
        secondwind · 3인 바이브 코딩 스튜디오
      </footer>
      <GlobalFeedback />
    </div>
  );
}
