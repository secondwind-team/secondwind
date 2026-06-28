"use client";

import type {
  FinzCurrencySummary,
  FinzHolding,
  FinzPortfolioCardPayload,
} from "@/lib/common/services/finz-portfolio";

function ccySym(c: string): string {
  return c === "USD" ? "$" : c === "KRW" ? "₩" : "";
}
function money(n: number, c: string): string {
  const v = c === "KRW" ? Math.round(n) : Math.round(n * 100) / 100;
  return `${ccySym(c)}${v.toLocaleString("en-US", { maximumFractionDigits: c === "KRW" ? 0 : 2 })}`;
}
function signedMoney(n: number, c: string): string {
  return `${n > 0 ? "+" : ""}${money(n, c)}`;
}
function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}
// 손익 색: 양수=gain, 음수=loss, 0=muted.
function pnlColor(n: number): string {
  if (n > 0) return "var(--fz-gain)";
  if (n < 0) return "var(--fz-loss)";
  return "var(--fz-muted)";
}

// 비중/섹터 바 — 폭만 weight%, 색은 코랄(중립 시각화).
function Bar({ weight }: { weight: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[var(--fz-r-full)] bg-[var(--fz-line)]">
      <div className="h-full rounded-[var(--fz-r-full)] bg-[var(--fz-coral)]" style={{ width: `${Math.min(Math.max(weight, 0), 100)}%` }} />
    </div>
  );
}

function SummaryRow({ s }: { s: FinzCurrencySummary }) {
  return (
    <div className="rounded-[var(--fz-r-sm)] bg-[var(--fz-surface-2)] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-[var(--fz-muted)]">투자원가</span>
        <span className="font-semibold tabular-nums">{money(s.invested, s.currency)}</span>
        {s.currentValue != null && (
          <>
            <span className="text-[var(--fz-muted)]">평가액</span>
            <span className="font-semibold tabular-nums">{money(s.currentValue, s.currency)}</span>
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {s.unrealizedPnl != null && s.returnPct != null && (
          <span className="font-bold tabular-nums" style={{ color: pnlColor(s.unrealizedPnl) }}>
            평가손익 {signedMoney(s.unrealizedPnl, s.currency)} ({signedPct(s.returnPct)})
          </span>
        )}
        {s.realizedPnl !== 0 && (
          <span className="tabular-nums" style={{ color: pnlColor(s.realizedPnl) }}>
            실현손익 {signedMoney(s.realizedPnl, s.currency)}
          </span>
        )}
      </div>
    </div>
  );
}

function HoldingRow({ h, price }: { h: FinzHolding; price?: number }) {
  const hasPrice = typeof price === "number" && price > 0;
  const value = hasPrice ? h.shares * price! : null;
  const pnl = value != null ? value - h.invested : null;
  const pct = pnl != null && h.invested > 0 ? Math.round((pnl / h.invested) * 1000) / 10 : null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">{h.label}</p>
        <p className="truncate text-xs text-[var(--fz-muted)] tabular-nums">
          {h.shares}주 · 평단 {money(h.avgCost, h.currency)}
          {h.owners.length > 1 ? ` · ${h.owners.join("·")}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums">
        {value != null ? (
          <>
            <p className="font-semibold text-[var(--fz-ink)]">{money(value, h.currency)}</p>
            {pnl != null && pct != null && (
              <p className="text-xs font-bold" style={{ color: pnlColor(pnl) }}>
                {signedMoney(pnl, h.currency)} ({signedPct(pct)})
              </p>
            )}
          </>
        ) : (
          <p className="text-[var(--fz-muted)]">{money(h.invested, h.currency)}</p>
        )}
      </div>
    </div>
  );
}

export function FinzPortfolioCard({ payload }: { payload: FinzPortfolioCardPayload }) {
  const open = payload.holdings.filter((h) => h.shares > 0);
  const closed = payload.holdings.filter((h) => h.shares === 0 && h.realizedPnl !== 0);
  const pricedAtLabel =
    payload.priced && payload.pricedAt
      ? new Date(Date.parse(payload.pricedAt) + 9 * 3600 * 1000).toISOString().slice(11, 16) + " 기준"
      : "";

  return (
    <section className="fz-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--fz-ink)]">📊 {payload.scopeLabel}</p>
        <span className="shrink-0 rounded-[var(--fz-r-full)] bg-[var(--fz-surface-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--fz-coral-ink)]">
          {payload.scope === "shared" ? "공동" : "개인"}
        </span>
      </div>

      {payload.summary.map((s) => (
        <SummaryRow key={s.currency} s={s} />
      ))}

      {payload.view === "sector" && payload.sectors && payload.sectors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--fz-muted)]">섹터 비중{payload.priced ? " (평가액 기준)" : " (원가 기준)"}</p>
          {payload.sectors.map((sec) => (
            <div key={sec.sector} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-[var(--fz-ink)]">{sec.sector}</span>
                <span className="tabular-nums text-[var(--fz-muted)]">{sec.weight}%</span>
              </div>
              <Bar weight={sec.weight} />
              <p className="truncate text-[11px] text-[var(--fz-muted)]">{sec.symbols.join(" · ")}</p>
            </div>
          ))}
        </div>
      ) : (
        open.length > 0 && (
          <div className="divide-y divide-[var(--fz-line)]">
            {open.map((h) => (
              <HoldingRow key={h.symbol} h={h} price={payload.prices?.[h.symbol]} />
            ))}
          </div>
        )
      )}

      {/* 비중 바(holdings 뷰) */}
      {payload.view === "holdings" && payload.allocation.length > 1 && (
        <div className="space-y-1.5 border-t border-[var(--fz-line)] pt-2">
          <p className="text-xs font-semibold text-[var(--fz-muted)]">보유 비중{payload.priced ? " (평가액)" : " (원가)"}</p>
          {payload.allocation.slice(0, 8).map((a) => (
            <div key={a.symbol} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-xs text-[var(--fz-ink)]">{a.label}</span>
              <Bar weight={a.weight} />
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--fz-muted)]">{a.weight}%</span>
            </div>
          ))}
        </div>
      )}

      {/* 청산된 종목 실현손익 */}
      {closed.length > 0 && (
        <div className="border-t border-[var(--fz-line)] pt-2">
          <p className="mb-1 text-xs font-semibold text-[var(--fz-muted)]">청산 (실현손익)</p>
          {closed.map((h) => (
            <div key={h.symbol} className="flex items-baseline justify-between text-sm">
              <span className="text-[var(--fz-ink)]">{h.label}</span>
              <span className="font-bold tabular-nums" style={{ color: pnlColor(h.realizedPnl) }}>
                {signedMoney(h.realizedPnl, h.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-[var(--fz-line)] pt-2 text-[11px] leading-relaxed text-[var(--fz-muted)]">
        {payload.asOfNote ? `${payload.asOfNote} ` : ""}
        {pricedAtLabel ? `현재가 ${pricedAtLabel} · ` : ""}
        ℹ️ 투자 조언이 아니라 정보 참고용이야.
        {payload.sources && payload.sources.length > 0 && (
          <> 🔎 출처: {[...new Set(payload.sources.map((s) => s.title).filter(Boolean))].slice(0, 3).join(", ")}</>
        )}
      </p>
    </section>
  );
}
