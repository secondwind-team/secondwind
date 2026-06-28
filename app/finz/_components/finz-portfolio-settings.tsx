"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  computeHoldings,
  summarizePortfolio,
  type FinzPortfolioScope,
  type FinzTradeAction,
  type FinzTrade,
} from "@/lib/common/services/finz-portfolio";
import { useFinzAccount } from "./finz-account-context";

function ccySym(c: string): string {
  return c === "USD" ? "$" : c === "KRW" ? "₩" : "";
}
function money(n: number, c: string): string {
  return `${ccySym(c)}${(c === "KRW" ? Math.round(n) : Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: c === "KRW" ? 0 : 2 })}`;
}
function pnlColor(n: number): string {
  return n > 0 ? "var(--fz-gain)" : n < 0 ? "var(--fz-loss)" : "var(--fz-muted)";
}

// 채팅방 설정의 포트폴리오 섹션 — 거래 내역 보기/추가/수정/삭제 + 보유 현황(원가·실현손익, 결정적). 현재가는 채팅에서 조회.
export function FinzPortfolioSettings({ groupId, initialTrades }: { groupId: string; initialTrades: FinzTrade[] }) {
  const account = useFinzAccount();
  const memberId = account.accountId;
  const [trades, setTrades] = useState<FinzTrade[]>(initialTrades);
  const [scope, setScope] = useState<FinzPortfolioScope>("personal");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinzTrade | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      scope === "shared"
        ? trades.filter((t) => t.scope === "shared")
        : trades.filter((t) => t.scope === "personal" && t.ownerId === memberId),
    [trades, scope, memberId],
  );
  const holdings = useMemo(() => computeHoldings(filtered), [filtered]);
  const open = holdings.filter((h) => h.shares > 0);
  const summary = useMemo(() => summarizePortfolio(holdings), [holdings]);
  // 거래 내역은 최신순.
  const txns = useMemo(
    () => [...filtered].sort((a, b) => Date.parse(b.tradedAt) - Date.parse(a.tradedAt) || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [filtered],
  );

  async function del(t: FinzTrade) {
    if (typeof window !== "undefined" && !window.confirm(`${t.label} ${t.shares}주 ${t.action === "buy" ? "매수" : "매도"} 기록을 삭제할까요?`)) return;
    setError(null);
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/finz/party/${groupId}/portfolio/${t.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const json = (await res.json()) as { status: string; trades?: FinzTrade[] };
      if (!res.ok || json.status !== "ok") throw new Error();
      if (json.trades) setTrades(json.trades);
    } catch {
      setError("삭제하지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setBusyId(null);
    }
  }

  async function submit(values: TradeFormValues) {
    setError(null);
    const id = editing?.id;
    try {
      const res = await fetch(id ? `/api/finz/party/${groupId}/portfolio/${id}` : `/api/finz/party/${groupId}/portfolio`, {
        method: id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, ...values }),
      });
      const json = (await res.json()) as { status: string; trades?: FinzTrade[]; reason?: string };
      if (res.status === 422 || json.reason === "invalid-input") {
        setError("종목(예: NASDAQ:TSLA)·수량·가격을 다시 확인해줘.");
        return;
      }
      if (res.status === 409 || json.reason === "limit") {
        setError("거래 기록이 너무 많아(최대 500건).");
        return;
      }
      if (!res.ok || json.status !== "ok") throw new Error();
      if (json.trades) setTrades(json.trades);
      setFormOpen(false);
      setEditing(null);
    } catch {
      setError("저장하지 못했어. 잠시 뒤 다시 시도해줘.");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-[var(--fz-ink)]">📊 포트폴리오</h2>
        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="fz-btn fz-btn--ghost px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            거래 추가
          </button>
        )}
      </div>
      <p className="px-1 text-xs leading-relaxed text-[var(--fz-muted)]">
        채팅방에서 “@finz 테슬라 400달러에 2주 매수 기록해줘” 처럼 말해도 기록돼요. 현재가·수익률은 채팅에서 “포트폴리오 보여줘”.
      </p>

      {/* 개인/공동 전환 */}
      <div className="flex gap-1.5">
        <Chip on={scope === "personal"} onClick={() => setScope("personal")}>
          내 포트폴리오
        </Chip>
        <Chip on={scope === "shared"} onClick={() => setScope("shared")}>
          공동 포트폴리오
        </Chip>
      </div>

      {error && <p className="fz-alert">{error}</p>}

      {/* 보유 요약(원가·실현손익 — 결정적) */}
      {summary.length > 0 ? (
        summary.map((s) => (
          <div key={s.currency} className="fz-card flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm">
            <span className="text-[var(--fz-muted)]">투자원가</span>
            <span className="font-semibold tabular-nums">{money(s.invested, s.currency)}</span>
            {s.realizedPnl !== 0 && (
              <span className="font-semibold tabular-nums" style={{ color: pnlColor(s.realizedPnl) }}>
                실현손익 {s.realizedPnl > 0 ? "+" : ""}
                {money(s.realizedPnl, s.currency)}
              </span>
            )}
          </div>
        ))
      ) : (
        <p className="px-1 py-2 text-center text-xs text-[var(--fz-muted)]">아직 거래 기록이 없어요.</p>
      )}

      {/* 보유 종목 */}
      {open.length > 0 && (
        <div className="fz-card divide-y divide-[var(--fz-line)] px-3 py-1">
          {open.map((h) => (
            <div key={h.symbol} className="flex items-baseline justify-between py-1.5 text-sm">
              <span className="font-semibold text-[var(--fz-ink)]">{h.label}</span>
              <span className="tabular-nums text-[var(--fz-muted)]">
                {h.shares}주 · 평단 {money(h.avgCost, h.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <TradeForm
          key={editing?.id ?? "new"}
          initial={editing}
          defaultScope={scope}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submit}
        />
      )}

      {/* 거래 내역 */}
      {txns.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-semibold text-[var(--fz-muted)]">거래 내역</p>
          {txns.map((t) => (
            <div key={t.id} className="fz-card flex items-center gap-2 p-3">
              <span
                className="shrink-0 rounded-[var(--fz-r-full)] px-2 py-0.5 text-[11px] font-bold"
                style={{
                  color: t.action === "buy" ? "var(--fz-gain)" : "var(--fz-loss)",
                  background: "var(--fz-surface-2)",
                }}
              >
                {t.action === "buy" ? "매수" : "매도"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">
                  {t.label} <span className="font-normal text-[var(--fz-muted)] tabular-nums">{t.shares}주 @ {money(t.price, t.currency)}</span>
                </p>
                <p className="truncate text-xs text-[var(--fz-muted)]">
                  {t.tradedAt.slice(0, 10)} · {t.ownerName}
                  {scope === "shared" ? " · 공동" : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="수정"
                onClick={() => {
                  setEditing(t);
                  setFormOpen(true);
                }}
                className="fz-iconbtn h-8 w-8 border-none bg-transparent shadow-none"
              >
                <Pencil className="h-4 w-4 text-[var(--fz-muted)]" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="삭제"
                disabled={busyId === t.id}
                onClick={() => del(t)}
                className="fz-iconbtn h-8 w-8 border-none bg-transparent shadow-none disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 text-[var(--fz-error)]" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type TradeFormValues = {
  action: FinzTradeAction;
  symbol: string;
  label: string;
  shares: number;
  price: number;
  currency: string;
  scope: FinzPortfolioScope;
  tradedAt: string;
};

function TradeForm({
  initial,
  defaultScope,
  onCancel,
  onSubmit,
}: {
  initial: FinzTrade | null;
  defaultScope: FinzPortfolioScope;
  onCancel: () => void;
  onSubmit: (v: TradeFormValues) => void;
}) {
  const [action, setAction] = useState<FinzTradeAction>(initial?.action ?? "buy");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [shares, setShares] = useState(String(initial?.shares ?? ""));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [scope, setScope] = useState<FinzPortfolioScope>(initial?.scope ?? defaultScope);
  const [tradedAt, setTradedAt] = useState((initial?.tradedAt ?? new Date().toISOString()).slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  function go() {
    const sh = parseFloat(shares);
    const pr = parseFloat(price);
    if (!symbol.trim() || !Number.isFinite(sh) || sh <= 0 || !Number.isFinite(pr) || submitting) return;
    setSubmitting(true);
    onSubmit({
      action,
      symbol: symbol.trim(),
      label: label.trim() || symbol.trim(),
      shares: sh,
      price: pr,
      currency,
      scope,
      tradedAt: new Date(`${tradedAt}T00:00:00Z`).toISOString(),
    });
  }

  return (
    <div className="fz-card space-y-3 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--fz-ink)]">{initial ? "거래 수정" : "새 거래"}</p>
        <button type="button" onClick={onCancel} aria-label="닫기" className="fz-iconbtn h-7 w-7 border-none bg-transparent shadow-none">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex gap-1.5">
        <Chip on={action === "buy"} onClick={() => setAction("buy")}>
          매수
        </Chip>
        <Chip on={action === "sell"} onClick={() => setAction("sell")}>
          매도
        </Chip>
      </div>
      <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="종목 심볼 (예: NASDAQ:TSLA, KRX:005930)" className="fz-input w-full" />
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="표시 이름 (예: 테슬라)" className="fz-input w-full" />
      <div className="flex gap-2">
        <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="수량" className="fz-input w-full" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="1주당 가격" className="fz-input w-full" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={currency === "USD"} onClick={() => setCurrency("USD")}>
          USD $
        </Chip>
        <Chip on={currency === "KRW"} onClick={() => setCurrency("KRW")}>
          KRW ₩
        </Chip>
        <span className="mx-1 self-center text-[var(--fz-muted)]">·</span>
        <Chip on={scope === "personal"} onClick={() => setScope("personal")}>
          개인
        </Chip>
        <Chip on={scope === "shared"} onClick={() => setScope("shared")}>
          공동
        </Chip>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fz-ink)]">
        거래일
        <input type="date" value={tradedAt} onChange={(e) => setTradedAt(e.target.value)} className="fz-input w-40" />
      </label>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="fz-btn fz-btn--ghost flex-1">
          취소
        </button>
        <button type="button" onClick={go} disabled={submitting} className="fz-btn flex-1 disabled:opacity-50">
          {initial ? "저장" : "추가"}
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`fz-chip ${on ? "fz-chip--on" : ""}`} aria-pressed={on}>
      {children}
    </button>
  );
}
