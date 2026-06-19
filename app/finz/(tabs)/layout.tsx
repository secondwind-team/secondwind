"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Rss, User, Users } from "lucide-react";

// 4탭 메신저 크롬: 상단 타이틀 + 스크롤 본문 + 하단 탭바. (방 화면은 이 레이아웃 밖이라 탭바 없음.)
const TABS = [
  { href: "/finz/friends", label: "친구", Icon: Users },
  { href: "/finz/chats", label: "대화", Icon: MessageCircle },
  { href: "/finz/feed", label: "피드", Icon: Rss },
  { href: "/finz/profile", label: "프로필", Icon: User },
] as const;

export default function FinzTabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = TABS.find((t) => pathname?.startsWith(t.href)) ?? TABS[1];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex-none border-b border-[var(--fz-line)] bg-[var(--fz-bg)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--fz-coral)]" aria-hidden />
          <h1 className="fz-display text-xl text-[var(--fz-ink)]">{active.label}</h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      <nav className="fz-tabbar" aria-label="메신저 탭">
        {TABS.map((t) => {
          const isActive = active.href === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`fz-tabbar__item ${isActive ? "fz-tabbar__item--on" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <t.Icon className="h-5 w-5" aria-hidden />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
