import type { Metadata } from "next";
import { FinzPartyCreate } from "../_components/finz-party-create";

export const metadata: Metadata = {
  title: "FINZ 파티 만들기",
  description: "친구와 함께할 FINZ 파티를 만들고 초대 링크를 받으세요.",
};

export default function FinzPartyCreatePage() {
  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-emerald-500" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">FINZ · 친구와 함께</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            친구와 함께할 파티를 만들어요.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            로그인 없이 취향 카드로 캐릭터를 소환하면 초대 링크가 만들어집니다. 친구가 링크로 들어와
            자기 캐릭터를 만들면 두 캐릭터가 한 파티에 모여요.
          </p>
        </div>
        <p className="relative mt-4 inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
          투자 조언이 아니라 친구들과 이야기할 대화 소재를 만드는 실험입니다.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <FinzPartyCreate />
      </section>
    </div>
  );
}
