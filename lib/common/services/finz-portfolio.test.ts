import { describe, expect, it } from "vitest";
import {
  computeAllocation,
  computeHoldings,
  inferTradeAction,
  normalizeCurrency,
  normalizeTrade,
  parsePriceLines,
  parseTradeFromText,
  resolveKnownSymbol,
  summarizePortfolio,
  type FinzTrade,
} from "./finz-portfolio";

let seq = 0;
function trade(p: Partial<FinzTrade> & { action: FinzTrade["action"]; symbol: string; shares: number; price: number }): FinzTrade {
  seq += 1;
  return {
    id: `t${seq}`,
    ownerId: p.ownerId ?? "u1",
    ownerName: p.ownerName ?? "지헌",
    scope: p.scope ?? "personal",
    action: p.action,
    symbol: p.symbol,
    label: p.label ?? p.symbol,
    shares: p.shares,
    price: p.price,
    currency: p.currency ?? "USD",
    tradedAt: p.tradedAt ?? `2026-06-${String(10 + seq).padStart(2, "0")}T00:00:00Z`,
    note: p.note ?? "",
    createdAt: p.tradedAt ?? `2026-06-${String(10 + seq).padStart(2, "0")}T00:00:00Z`,
  };
}

describe("computeHoldings — 사용자 예시(테슬라 평단)", () => {
  it("400@2주 + 410@2주 → 평단 405, 4주, 원가 1620", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:TSLA", label: "테슬라", shares: 2, price: 400 }),
      trade({ action: "buy", symbol: "NASDAQ:TSLA", label: "테슬라", shares: 2, price: 410 }),
    ]);
    expect(h).toHaveLength(1);
    expect(h[0]?.shares).toBe(4);
    expect(h[0]?.avgCost).toBe(405);
    expect(h[0]?.invested).toBe(1620);
    expect(h[0]?.realizedPnl).toBe(0);
  });

  it("매도 시 실현손익 = (매도가-평단)*수량, 평단 유지", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 2, price: 400 }),
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 2, price: 410 }),
      trade({ action: "sell", symbol: "NASDAQ:TSLA", shares: 2, price: 420 }),
    ]);
    expect(h[0]?.shares).toBe(2);
    expect(h[0]?.avgCost).toBe(405); // 평단 유지
    expect(h[0]?.realizedPnl).toBe(30); // (420-405)*2
    expect(h[0]?.invested).toBe(810); // 2 * 405
  });

  it("전량 매도하면 보유 0, 실현손익은 남음", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:AAPL", shares: 10, price: 100 }),
      trade({ action: "sell", symbol: "NASDAQ:AAPL", shares: 10, price: 120 }),
    ]);
    expect(h[0]?.shares).toBe(0);
    expect(h[0]?.invested).toBe(0);
    expect(h[0]?.realizedPnl).toBe(200);
  });

  it("보유보다 많이 팔면 보유분까지만 반영(과매도 무시)", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:NVDA", shares: 3, price: 100 }),
      trade({ action: "sell", symbol: "NASDAQ:NVDA", shares: 10, price: 150 }),
    ]);
    expect(h[0]?.shares).toBe(0);
    expect(h[0]?.realizedPnl).toBe(150); // (150-100)*3 만
  });

  it("여러 소유자 집계(공동 포트폴리오)", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 1, price: 400, ownerName: "지헌", scope: "shared" }),
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 1, price: 410, ownerName: "태훈", scope: "shared" }),
    ]);
    expect(h[0]?.owners.sort()).toEqual(["지헌", "태훈"]);
    expect(h[0]?.shares).toBe(2);
  });
});

describe("summarizePortfolio — 통화별 + 현재가 평가", () => {
  it("현재가 없으면 원가·실현손익만, 평가관련 null", () => {
    seq = 0;
    const h = computeHoldings([trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 2, price: 400 })]);
    const s = summarizePortfolio(h);
    expect(s[0]?.currency).toBe("USD");
    expect(s[0]?.invested).toBe(800);
    expect(s[0]?.currentValue).toBeNull();
    expect(s[0]?.returnPct).toBeNull();
  });

  it("현재가 주면 평가손익·수익률 계산", () => {
    seq = 0;
    const h = computeHoldings([trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 4, price: 405 })]);
    const s = summarizePortfolio(h, { "NASDAQ:TSLA": 450 });
    expect(s[0]?.currentValue).toBe(1800); // 4*450
    expect(s[0]?.unrealizedPnl).toBe(180); // 1800 - 1620
    expect(s[0]?.returnPct).toBeCloseTo(11.11, 1);
  });

  it("통화 섞이면 통화별로 분리", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 1, price: 400, currency: "USD" }),
      trade({ action: "buy", symbol: "KRX:005930", shares: 10, price: 70000, currency: "KRW" }),
    ]);
    const s = summarizePortfolio(h);
    expect(s.map((x) => x.currency).sort()).toEqual(["KRW", "USD"]);
  });
});

describe("computeAllocation", () => {
  it("원가 기준 비중(주 통화)", () => {
    seq = 0;
    const h = computeHoldings([
      trade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 1, price: 300 }),
      trade({ action: "buy", symbol: "NASDAQ:AAPL", shares: 1, price: 100 }),
    ]);
    const a = computeAllocation(h, "invested");
    expect(a[0]?.symbol).toBe("NASDAQ:TSLA");
    expect(a[0]?.weight).toBe(75);
    expect(a[1]?.weight).toBe(25);
  });
});

describe("parsePriceLines", () => {
  it("SYMBOL=NUMBER 라인 파싱(보유 심볼만)", () => {
    const t = "NASDAQ:TSLA=412.30\nNASDAQ:AAPL: 195\nKRX:005930 = 71,200\nNOISE 무시";
    const p = parsePriceLines(t, ["NASDAQ:TSLA", "KRX:005930"]);
    expect(p["NASDAQ:TSLA"]).toBe(412.3);
    expect(p["KRX:005930"]).toBe(71200);
    expect(p["NASDAQ:AAPL"]).toBeUndefined(); // 보유 목록에 없음
  });
});

describe("resolveKnownSymbol / inferTradeAction (LLM 누락 보강)", () => {
  it("한글/영문 종목명 → TradingView 심볼", () => {
    expect(resolveKnownSymbol("테슬라")).toBe("NASDAQ:TSLA");
    expect(resolveKnownSymbol("엔비디아 더 살까")).toBe("NASDAQ:NVDA");
    expect(resolveKnownSymbol("삼성전자")).toBe("KRX:005930");
    expect(resolveKnownSymbol("Tesla")).toBe("NASDAQ:TSLA");
    expect(resolveKnownSymbol("듣보종목")).toBeNull();
  });
  it("긴 이름 우선 매칭(삼성전자 vs 삼성 충돌 방지 의도)", () => {
    expect(resolveKnownSymbol("삼성전자 2주")).toBe("KRX:005930");
  });
  it("문장에서 매수/매도 추론(기본 매수)", () => {
    expect(inferTradeAction("테슬라 2주 샀어")).toBe("buy");
    expect(inferTradeAction("엔비디아 10주 팔았어")).toBe("sell");
    expect(inferTradeAction("매도했어")).toBe("sell");
    expect(inferTradeAction("기록해줘")).toBe("buy");
  });
  it("normalizeTrade 가 한글 symbol 을 사전으로 보강", () => {
    const n = normalizeTrade({ action: "buy", symbol: "테슬라", label: "테슬라", shares: 2, price: 400 }, "2026-06-28T05:00:00Z");
    expect(n?.symbol).toBe("NASDAQ:TSLA");
  });
});

describe("parseTradeFromText (결정적 — LLM 의존 X)", () => {
  it("사용자 예시: '오늘 테슬라 2주 400 달러에 매수했어'", () => {
    const p = parseTradeFromText("오늘 테슬라 2주 400 달러에 매수했어. 포트폴리오에 기록해줘.");
    expect(p.symbol).toBe("NASDAQ:TSLA");
    expect(p.shares).toBe(2);
    expect(p.price).toBe(400);
    expect(p.currency).toBe("USD");
    expect(p.action).toBe("buy");
  });
  it("가격이 먼저 와도, 매도/원화도", () => {
    const p = parseTradeFromText("삼성전자 70,000원에 10주 팔았어");
    expect(p.symbol).toBe("KRX:005930");
    expect(p.shares).toBe(10);
    expect(p.price).toBe(70000);
    expect(p.currency).toBe("KRW");
    expect(p.action).toBe("sell");
  });
  it("수량/가격 단위 없으면 null(주·통화단위로만 잡음)", () => {
    const p = parseTradeFromText("테슬라 좋아 보여");
    expect(p.symbol).toBe("NASDAQ:TSLA");
    expect(p.shares).toBeNull();
    expect(p.price).toBeNull();
  });
});

describe("normalizeTrade / normalizeCurrency", () => {
  const now = "2026-06-28T05:00:00Z";
  it("정상 매수 정규화", () => {
    const n = normalizeTrade(
      { action: "buy", symbol: "nasdaq:tsla", label: "테슬라", shares: "2", price: "400", currency: "달러" },
      now,
    );
    expect(n).toMatchObject({ action: "buy", symbol: "NASDAQ:TSLA", shares: 2, price: 400, currency: "USD", scope: "personal" });
  });
  it("원화/KRX 통화 추론", () => {
    expect(normalizeCurrency("원")).toBe("KRW");
    expect(normalizeCurrency("", "KRX:005930")).toBe("KRW");
    expect(normalizeCurrency("")).toBe("USD");
  });
  it("필수 누락/비정상이면 null", () => {
    expect(normalizeTrade({ action: "buy", symbol: "삼성", shares: 1, price: 1 }, now)).toBeNull(); // 한글만 → 심볼 null
    expect(normalizeTrade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 0, price: 1 }, now)).toBeNull();
    expect(normalizeTrade({ action: "hold", symbol: "NASDAQ:TSLA", shares: 1, price: 1 }, now)).toBeNull();
  });
  it("미래 일자는 now 로 보정", () => {
    const n = normalizeTrade({ action: "buy", symbol: "NASDAQ:TSLA", shares: 1, price: 1, tradedAt: "2099-01-01T00:00:00Z" }, now);
    expect(n?.tradedAt).toBe(now);
  });
});
