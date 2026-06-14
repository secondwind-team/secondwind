import { Check } from "lucide-react";
import type { FinzPartyPick } from "@/lib/common/services/finz";

// 파티 우정주 결과 렌더. 멤버별 rolePrompts 를 각자 관점 카드로 펼친다.
export function FinzPartyPickResult({ pick }: { pick: FinzPartyPick }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-[var(--shadow-soft)]">
      <div className="border-b border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              today&apos;s friendship stock
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">{pick.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{pick.oneLine}</p>
          </div>
          <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
            테마
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <PickList title="왜 이 조합인가" items={pick.whyThisParty} />
          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">갈릴 포인트</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{pick.debatePoint}</p>
          </section>
          <PickList title="첫 질문" items={pick.openingQuestions} />
          <PickList title="대화가 끊겼을 때" items={pick.conversationSeeds} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {pick.rolePrompts.map((rp, i) => (
            <section key={i} className="rounded-xl border border-emerald-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-[var(--ink)]">
                {rp.memberName}의 관점 <span className="text-emerald-700">({rp.role})</span>
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{rp.prompt}</p>
            </section>
          ))}
        </div>

        <PickList title="주의" items={pick.caveats} />
      </div>
    </section>
  );
}

function PickList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-[var(--ink)]">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
