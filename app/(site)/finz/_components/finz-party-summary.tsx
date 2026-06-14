import type { FinzPartySummary } from "@/lib/common/services/finz";

// 진행자 1-shot 파티 요약 + 안전 문구.
export function FinzPartySummaryCard({ summary }: { summary: FinzPartySummary }) {
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50/60 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">ai 파티 요약</p>
      <p className="text-base leading-relaxed text-[var(--ink)]">{summary.summary}</p>
      <p className="text-sm leading-relaxed text-emerald-800">{summary.nextNudge}</p>
      <p className="border-t border-emerald-200 pt-3 text-xs leading-relaxed text-[var(--muted)]">
        FINZ는 투자 조언이나 매매 추천이 아니라, 친구들과 이야기할 대화 소재를 만드는 실험이에요. &lsquo;사세요&rsquo;가 아니라 &lsquo;얘기해보세요&rsquo;.
      </p>
    </section>
  );
}
