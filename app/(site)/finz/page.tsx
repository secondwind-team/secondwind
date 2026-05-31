import type { Metadata } from "next";
import { FinzTasteSelector } from "./_components/finz-taste-selector";

export const metadata: Metadata = {
  title: "FINZ",
  description: "친구들과 오늘 이야기할 우정주를 찾는 게임형 투자 대화 실험.",
};

export default function FinzPage() {
  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5 bg-emerald-500"
        />
        <div
          aria-hidden
          className="absolute right-6 top-6 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 lg:block"
        >
          MVP 1 · 취향 카드 선택
        </div>
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            FINZ · 핀즈
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl sm:leading-tight">
            친구들과 오늘 이야기할
            <br />
            우정주를 고르는 첫 장면.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            어려운 종목 검색 대신 취향 카드부터 고릅니다. FINZ는 선택한 카드로
            투자 캐릭터를 소환하고, 다음 단계에서 친구 그룹의 오늘의 우정주 레이드로
            이어집니다.
          </p>
        </div>
        <p className="relative mt-4 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
          투자 조언이 아니라 친구들과 이야기할 대화 소재를 만드는 실험입니다.
        </p>
      </header>

      <FinzTasteSelector />
    </div>
  );
}
