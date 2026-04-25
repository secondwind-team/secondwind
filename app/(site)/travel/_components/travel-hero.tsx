import type { ReactNode } from "react";

export function TravelHero({
  eyebrow = "travel concierge",
  title = (
    <>
      이번 여행,
      <br />
      하나만 고르면 되게.
    </>
  ),
  description = (
    <>
      목적지와 날짜, 그리고 같이 가는 사람의 맥락만 알려주세요.
      선택지는 숨기고 바로 실행할 수 있는 하나의 확정안을 만듭니다.
    </>
  ),
  badge = "지금은 국내 여행을 더 잘 맞춥니다. 해외 여행은 다음 이터레이션에서 지원 예정.",
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-soft)] sm:p-10">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5 bg-[var(--accent)]"
      />
      <div
        aria-hidden
        className="absolute right-8 top-8 hidden rounded-2xl border border-[var(--line)] bg-slate-50 px-4 py-3 text-xs text-[var(--muted)] sm:block"
      >
        확정안 중심 · 국내 여행 v0
      </div>
      <div className="relative max-w-2xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl sm:leading-tight">
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      </div>
      {badge && (
        <p className="relative mt-6 inline-flex rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent-strong)]">
          {badge}
        </p>
      )}
    </header>
  );
}
