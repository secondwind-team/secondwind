import type { FinzPartyPick } from "@/lib/common/services/finz";
import { FinzInlineText } from "./finz-rich-text";

// 파티 우정주 결과 — 진행자(FINZ)가 던지는 큰 말풍선 + 멤버별 관점 카드.
export function FinzPartyPickResult({ pick }: { pick: FinzPartyPick }) {
  return (
    <section className="fz-bubble fz-bubble--pick p-5">
      <span className="fz-tag">오늘의 우정주 · 테마</span>
      <h3 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">{pick.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">
        <FinzInlineText text={pick.oneLine} />
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PickList title="왜 이 조합인가" items={pick.whyThisParty} />
        <div className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4">
          <h5 className="text-sm font-semibold text-[var(--fz-ink)]">갈릴 포인트</h5>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">
            <FinzInlineText text={pick.debatePoint} />
          </p>
        </div>
        <PickList title="첫 질문" items={pick.openingQuestions} />
        <PickList title="대화가 끊겼을 때" items={pick.conversationSeeds} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {pick.rolePrompts.map((rp, i) => (
          <div key={i} className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-4">
            <h5 className="text-sm font-semibold text-[var(--fz-ink)]">
              {rp.memberName}의 관점 <span className="text-[var(--fz-coral-ink)]">({rp.role})</span>
            </h5>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">
              <FinzInlineText text={rp.prompt} />
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <PickList title="주의" items={pick.caveats} />
      </div>
    </section>
  );
}

function PickList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-4">
      <h5 className="text-sm font-semibold text-[var(--fz-ink)]">{title}</h5>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--fz-muted)]">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fz-coral)]" aria-hidden />
            <span><FinzInlineText text={item} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
