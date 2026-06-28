import type { FinzPartySummary } from "@/lib/common/services/finz";
import { FinzInlineText } from "./finz-rich-text";

// 진행자 1-shot 파티 요약 — 앰버 말풍선 + 안전 문구.
export function FinzPartySummaryCard({ summary }: { summary: FinzPartySummary }) {
  return (
    <section className="fz-bubble fz-bubble--amber p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fz-amber-ink)]">ai 파티 요약</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--fz-ink)]">
        <FinzInlineText text={summary.summary} />
      </p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--fz-amber-ink)]">
        <FinzInlineText text={summary.nextNudge} />
      </p>
      <p className="mt-3 border-t border-[#fbe6bd] pt-3 text-xs leading-relaxed text-[var(--fz-muted)]">
        FINZ는 투자 조언이나 매매 추천이 아니라, 친구들과 이야기할 대화 소재를 만드는 실험이에요. ‘사세요’가 아니라 ‘얘기해보세요’.
      </p>
    </section>
  );
}
