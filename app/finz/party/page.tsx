import type { Metadata } from "next";
import { FinzPartyCreate } from "../_components/finz-party-create";

export const metadata: Metadata = {
  title: "파티 만들기",
  description: "친구와 함께할 FINZ 파티를 만들고 초대 링크를 받으세요.",
};

export default function FinzPartyCreatePage() {
  return (
    <div className="space-y-5">
      <header className="fz-bubble fz-bubble--pick p-5 sm:p-6">
        <p className="fz-seclabel">finz · 친구와 함께</p>
        <h1 className="fz-display mt-2 text-2xl leading-tight text-[var(--fz-ink)] sm:text-3xl">친구와 함께할 파티를 만들어.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          로그인 없이 취향 카드로 캐릭터를 소환하면 초대 링크가 만들어져. 친구가 링크로 들어와 자기 캐릭터를 만들면 두 캐릭터가 한 파티에 모여.
        </p>
      </header>

      <section className="fz-card p-5 sm:p-6">
        <FinzPartyCreate />
      </section>
    </div>
  );
}
