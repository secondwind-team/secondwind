// FINZ 포트폴리오 — 클라이언트/서버 공용 순수 모델(I/O 없음, 단위 테스트 대상).
//
// 핵심 철학(채팅 타임라인과 동일): 거래(매수/매도)는 append-only 이벤트이고, 보유 현황(평단·수량·실현손익)은
// 거기서 "파생 계산"한다. 저장하는 건 거래뿐 — 보유 현황은 항상 거래로부터 결정적으로 재계산한다(환각 0).
//
// 현재가/평가손익처럼 실시간 사실이 필요한 값은 여기서 계산하지 않는다 — 호출부가 그라운딩 LLM 으로
// 현재가를 받아 prices 맵으로 넘기면 summarizePortfolio 가 평가손익을 계산한다(없으면 생략). 차트(가격)는
// TradingView 가 담당. → 결정적 부분(평단·실현손익)은 정확, 실시간 부분만 외부 소스에 의존.

// TradingView 심볼 정규화(거래소:티커, 허용 외 문자 제거). finz-chat 의 normalizeChartSymbol 과 같은 규칙을
// 의도적으로 로컬 정의 — finz-chat 이 이 모듈(카드 페이로드)을 import 하므로 순환참조를 피한다.
function normalizeSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9:._-]/g, "").slice(0, 24);
  return cleaned.length > 0 ? cleaned : null;
}

export type FinzTradeAction = "buy" | "sell";
// personal = 기록한 사람의 개인 포트폴리오 / shared = 방 공동(pooled) 포트폴리오.
export type FinzPortfolioScope = "personal" | "shared";

// 자주 쓰는 종목명(한/영) → TradingView 심볼. LLM 이 심볼을 한글로 주거나 못 줄 때의 결정적 폴백.
// (키는 소문자·공백제거 후 비교. 부분 포함 매칭이라 긴 이름을 먼저 검사한다.)
const KNOWN_SYMBOLS: Record<string, string> = {
  삼성전자: "KRX:005930",
  sk하이닉스: "KRX:000660",
  하이닉스: "KRX:000660",
  네이버: "KRX:035420",
  naver: "KRX:035420",
  카카오: "KRX:035720",
  kakao: "KRX:035720",
  현대차: "KRX:005380",
  기아: "KRX:000270",
  lg에너지솔루션: "KRX:373220",
  에코프로비엠: "KOSDAQ:247540",
  테슬라: "NASDAQ:TSLA",
  tesla: "NASDAQ:TSLA",
  tsla: "NASDAQ:TSLA",
  엔비디아: "NASDAQ:NVDA",
  nvidia: "NASDAQ:NVDA",
  nvda: "NASDAQ:NVDA",
  애플: "NASDAQ:AAPL",
  apple: "NASDAQ:AAPL",
  aapl: "NASDAQ:AAPL",
  마이크로소프트: "NASDAQ:MSFT",
  microsoft: "NASDAQ:MSFT",
  msft: "NASDAQ:MSFT",
  아마존: "NASDAQ:AMZN",
  amazon: "NASDAQ:AMZN",
  amzn: "NASDAQ:AMZN",
  알파벳: "NASDAQ:GOOGL",
  구글: "NASDAQ:GOOGL",
  google: "NASDAQ:GOOGL",
  googl: "NASDAQ:GOOGL",
  메타: "NASDAQ:META",
  페이스북: "NASDAQ:META",
  meta: "NASDAQ:META",
  넷플릭스: "NASDAQ:NFLX",
  netflix: "NASDAQ:NFLX",
  nflx: "NASDAQ:NFLX",
  팔란티어: "NASDAQ:PLTR",
  pltr: "NASDAQ:PLTR",
  amd: "NASDAQ:AMD",
  코인베이스: "NASDAQ:COIN",
  coinbase: "NASDAQ:COIN",
  // 암호화폐(TradingView BINANCE 쌍). 차트/포트폴리오 심볼 해석용.
  비트코인: "BINANCE:BTCUSDT",
  bitcoin: "BINANCE:BTCUSDT",
  btc: "BINANCE:BTCUSDT",
  이더리움: "BINANCE:ETHUSDT",
  ethereum: "BINANCE:ETHUSDT",
  eth: "BINANCE:ETHUSDT",
  솔라나: "BINANCE:SOLUSDT",
  solana: "BINANCE:SOLUSDT",
  sol: "BINANCE:SOLUSDT",
  리플: "BINANCE:XRPUSDT",
  xrp: "BINANCE:XRPUSDT",
  도지코인: "BINANCE:DOGEUSDT",
  도지: "BINANCE:DOGEUSDT",
  doge: "BINANCE:DOGEUSDT",
};
const KNOWN_NAMES_BY_LENGTH = Object.keys(KNOWN_SYMBOLS).sort((a, b) => b.length - a.length);

// 종목명/문장에서 알려진 종목(심볼 + 매칭된 이름)을 찾는다(소문자·공백제거 후 포함 매칭, 긴 이름 우선).
export function resolveKnownStock(text: unknown): { symbol: string; name: string } | null {
  if (typeof text !== "string") return null;
  const t = text.toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  for (const name of KNOWN_NAMES_BY_LENGTH) {
    if (t.includes(name)) return { symbol: KNOWN_SYMBOLS[name]!, name };
  }
  return null;
}
export function resolveKnownSymbol(text: unknown): string | null {
  return resolveKnownStock(text)?.symbol ?? null;
}

// 문장에서 매수/매도 추론(LLM 이 action 을 빠뜨릴 때 폴백). 기본은 매수.
export function inferTradeAction(text: unknown): FinzTradeAction {
  const t = typeof text === "string" ? text : "";
  return /매도|팔았|팔아|매각|sold|sell|익절|손절/.test(t) ? "sell" : "buy";
}

// 문장에서 거래를 결정적으로 파싱(LLM 의존 X) — "테슬라 2주 400달러 매수" 류 표준 표현용. 부분 결과 허용.
// '주'→수량, '달러/$/원/₩'→가격+통화, 알려진 종목명→심볼/라벨, 매수/매도 키워드→action.
export type ParsedTradeText = {
  symbol: string | null;
  label: string | null;
  shares: number | null;
  price: number | null;
  currency: string | null;
  action: FinzTradeAction;
};
export function parseTradeFromText(text: unknown): ParsedTradeText {
  const t = typeof text === "string" ? text : "";
  const stock = resolveKnownStock(t);

  const sharesM = t.match(/(\d[\d,]*(?:\.\d+)?)\s*주/);
  const shares = sharesM?.[1] ? Number(sharesM[1].replace(/,/g, "")) : null;

  // 가격 + 통화 단위. 단위가 명시된 숫자만(수량 '주'와 혼동 방지).
  const usdM = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:달러|불|\$|usd|dollars?)/i);
  const krwM = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:원|₩|krw|won)/i);
  let price: number | null = null;
  let currency: string | null = null;
  if (usdM?.[1]) {
    price = Number(usdM[1].replace(/,/g, ""));
    currency = "USD";
  } else if (krwM?.[1]) {
    price = Number(krwM[1].replace(/,/g, ""));
    currency = "KRW";
  }

  return {
    symbol: stock?.symbol ?? null,
    label: stock?.name ?? null,
    shares: shares != null && Number.isFinite(shares) && shares > 0 ? shares : null,
    price: price != null && Number.isFinite(price) && price >= 0 ? price : null,
    currency,
    action: inferTradeAction(t),
  };
}

export type FinzTrade = {
  id: string;
  ownerId: string; // 기록한 멤버(=accountId)
  ownerName: string; // 표시 이름
  scope: FinzPortfolioScope;
  action: FinzTradeAction;
  symbol: string; // 정규화된 TradingView 심볼(거래소:티커), 예 NASDAQ:TSLA
  label: string; // 표시명, 예 "테슬라"
  shares: number; // > 0
  price: number; // 1주당 가격(currency 기준), > 0
  currency: string; // "USD" | "KRW" 등(대문자)
  tradedAt: string; // 거래 일자(ISO)
  note: string;
  createdAt: string; // 기록 시각(ISO)
};

export type FinzHolding = {
  symbol: string;
  label: string;
  currency: string;
  shares: number; // 현재 보유 수량(>= 0)
  avgCost: number; // 보유분 평균 매입단가
  invested: number; // shares * avgCost (현재 보유분 원가)
  realizedPnl: number; // 누적 실현손익(매도로 확정)
  buyShares: number;
  sellShares: number;
  owners: string[]; // 이 종목을 거래한 사람들(공동 포트폴리오 표시용)
  lastTradedAt: string;
};

export const MAX_TRADES_PER_ROOM = 500;
export const TRADE_NOTE_MAX = 120;
export const TRADE_LABEL_MAX = 40;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// 통화 정규화 — '원/₩/krw' → KRW, 그 외(달러/$/usd/빈값)는 USD. 심볼이 KRX 면 KRW 로 보정.
export function normalizeCurrency(raw: unknown, symbol?: string): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (/원|₩|krw|won/.test(s)) return "KRW";
  if (/\$|달러|usd|dollar/.test(s)) return "USD";
  if (symbol && /^KRX:/i.test(symbol)) return "KRW";
  return "USD";
}

// 거래 시간 정렬 키 — tradedAt 우선, 같으면 createdAt(기록 순서)로 안정 정렬.
function chronoKey(t: FinzTrade): number {
  const a = Date.parse(t.tradedAt);
  const b = Date.parse(t.createdAt);
  return (Number.isFinite(a) ? a : 0) * 1 + (Number.isFinite(b) ? b / 1e13 : 0);
}

// 거래 목록 → 종목별 보유 현황(평균단가법). 매도는 보유분에서 차감, 실현손익 = (매도가 - 평단) * 매도수량.
// 보유 0이 된 종목도 실현손익을 위해 유지한다(호출부가 보유중/청산 구분).
export function computeHoldings(trades: FinzTrade[]): FinzHolding[] {
  const sorted = [...trades].sort((x, y) => chronoKey(x) - chronoKey(y));
  const map = new Map<string, FinzHolding & { _owners: Set<string> }>();

  for (const t of sorted) {
    if (t.shares <= 0 || t.price < 0) continue;
    let h = map.get(t.symbol);
    if (!h) {
      h = {
        symbol: t.symbol,
        label: t.label || t.symbol,
        currency: t.currency,
        shares: 0,
        avgCost: 0,
        invested: 0,
        realizedPnl: 0,
        buyShares: 0,
        sellShares: 0,
        owners: [],
        lastTradedAt: t.tradedAt,
        _owners: new Set<string>(),
      };
      map.set(t.symbol, h);
    }
    h.label = t.label || h.label;
    h.currency = t.currency || h.currency;
    h.lastTradedAt = t.tradedAt || h.lastTradedAt;
    if (t.ownerName) h._owners.add(t.ownerName);

    if (t.action === "buy") {
      const totalCost = h.shares * h.avgCost + t.shares * t.price;
      h.shares += t.shares;
      h.avgCost = h.shares > 0 ? totalCost / h.shares : 0;
      h.buyShares += t.shares;
    } else {
      // 보유보다 많이 팔면 보유분까지만 반영(과매도 무시).
      const sellQty = Math.min(t.shares, h.shares);
      if (sellQty > 0) {
        h.realizedPnl += (t.price - h.avgCost) * sellQty;
        h.shares -= sellQty;
        h.sellShares += sellQty;
        if (h.shares === 0) h.avgCost = h.avgCost; // 평단 유지(다시 사면 새로 계산)
      }
    }
  }

  return [...map.values()].map((h) => ({
    symbol: h.symbol,
    label: h.label,
    currency: h.currency,
    shares: round2(h.shares),
    avgCost: round2(h.avgCost),
    invested: round2(h.shares * h.avgCost),
    realizedPnl: round2(h.realizedPnl),
    buyShares: round2(h.buyShares),
    sellShares: round2(h.sellShares),
    owners: [...h._owners],
    lastTradedAt: h.lastTradedAt,
  }));
}

export type FinzCurrencySummary = {
  currency: string;
  invested: number; // 보유분 원가 합
  realizedPnl: number; // 실현손익 합
  currentValue: number | null; // 현재가 있는 종목들의 평가액 합(없으면 null)
  unrealizedPnl: number | null; // 평가손익(현재가 있는 종목 한정)
  returnPct: number | null; // 평가손익률 %
  pricedInvested: number; // 현재가가 있는 종목들의 원가 합(returnPct 분모)
};

// 보유 현황 요약 — 통화별로 묶어 원가/실현손익/(현재가 있으면)평가액·평가손익·수익률.
// prices: symbol → 현재가(통화는 holding.currency 기준). 없으면 평가 관련은 null.
export function summarizePortfolio(
  holdings: FinzHolding[],
  prices?: Record<string, number>,
): FinzCurrencySummary[] {
  const byCcy = new Map<string, FinzCurrencySummary>();
  for (const h of holdings) {
    let s = byCcy.get(h.currency);
    if (!s) {
      s = {
        currency: h.currency,
        invested: 0,
        realizedPnl: 0,
        currentValue: null,
        unrealizedPnl: null,
        returnPct: null,
        pricedInvested: 0,
      };
      byCcy.set(h.currency, s);
    }
    s.invested += h.invested;
    s.realizedPnl += h.realizedPnl;
    const px = prices?.[h.symbol];
    if (h.shares > 0 && typeof px === "number" && Number.isFinite(px) && px > 0) {
      s.currentValue = (s.currentValue ?? 0) + h.shares * px;
      s.pricedInvested += h.invested;
    }
  }
  for (const s of byCcy.values()) {
    s.invested = round2(s.invested);
    s.realizedPnl = round2(s.realizedPnl);
    if (s.currentValue != null) {
      s.currentValue = round2(s.currentValue);
      s.unrealizedPnl = round2(s.currentValue - s.pricedInvested);
      s.returnPct = s.pricedInvested > 0 ? round2((s.unrealizedPnl / s.pricedInvested) * 100) : null;
    }
    s.pricedInvested = round2(s.pricedInvested);
  }
  return [...byCcy.values()].sort((a, b) => b.invested - a.invested);
}

export type FinzAllocationSlice = { symbol: string; label: string; weight: number; amount: number; currency: string };

// 보유 비중(차트용) — basis 'value'(현재가*수량, prices 필요) 또는 'invested'(원가). 보유중(shares>0)만.
// 통화가 섞이면 정확한 단일 비중이 어려우므로, 가장 원가가 큰 통화 그룹 기준으로 계산한다(단순·실용).
export function computeAllocation(
  holdings: FinzHolding[],
  basis: "value" | "invested",
  prices?: Record<string, number>,
): FinzAllocationSlice[] {
  const open = holdings.filter((h) => h.shares > 0);
  if (open.length === 0) return [];
  // 주 통화 = 원가 합이 가장 큰 통화.
  const investedByCcy = new Map<string, number>();
  for (const h of open) investedByCcy.set(h.currency, (investedByCcy.get(h.currency) ?? 0) + h.invested);
  let mainCcy = open[0]!.currency;
  let max = -1;
  for (const [c, v] of investedByCcy) if (v > max) ((max = v), (mainCcy = c));

  const slices = open
    .filter((h) => h.currency === mainCcy)
    .map((h) => {
      const px = prices?.[h.symbol];
      const amount =
        basis === "value" && typeof px === "number" && Number.isFinite(px) ? h.shares * px : h.invested;
      return { symbol: h.symbol, label: h.label, amount: round2(amount), currency: h.currency, weight: 0 };
    });
  const total = slices.reduce((a, s) => a + s.amount, 0);
  for (const s of slices) s.weight = total > 0 ? round2((s.amount / total) * 100) : 0;
  return slices.sort((a, b) => b.amount - a.amount);
}

// LLM 이 추출한 종목 현재가 텍스트("NASDAQ:TSLA=412.3" 줄들 또는 자유 텍스트)에서 symbol→price 파싱(관용적).
// 그라운딩은 JSON 스키마를 못 쓰므로, 'SYMBOL=NUMBER' 우선 + 폴백으로 라벨/티커 근처 숫자 매칭.
export function parsePriceLines(text: string, symbols: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!text) return out;
  for (const line of text.split(/\n+/)) {
    const m = line.match(/([A-Z0-9:._-]{1,24})\s*[=:]\s*([0-9][0-9,]*\.?[0-9]*)/i);
    if (m && m[1] && m[2]) {
      const sym = normalizeSymbol(m[1]);
      const val = parseFloat(m[2].replace(/,/g, ""));
      if (sym && Number.isFinite(val) && val > 0 && symbols.includes(sym)) out[sym] = val;
    }
  }
  return out;
}

// ── 입력 정규화(구조화 폼 + LLM 추출 공용) ──
export type NormalizedTrade = {
  action: FinzTradeAction;
  symbol: string;
  label: string;
  shares: number;
  price: number;
  currency: string;
  scope: FinzPortfolioScope;
  tradedAt: string; // ISO
  note: string;
};

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}

// 거래 입력 검증·정규화. 필수(심볼·수량>0·가격>=0) 미충족이면 null(호출부가 안내 폴백).
// nowIso: tradedAt 기본값. 'today' 같은 상대표현은 호출부(LLM)가 날짜로 변환하거나 비우면 now 사용.
export function normalizeTrade(raw: unknown, nowIso: string): NormalizedTrade | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const action: FinzTradeAction = r.action === "sell" ? "sell" : r.action === "buy" ? "buy" : (null as never);
  if (action !== "buy" && action !== "sell") return null;

  // 심볼: LLM 이 깔끔한 거래소:티커를 주면 그대로, 한글/누락이면 알려진 종목 사전(심볼 또는 라벨)으로 폴백.
  const symbol = normalizeSymbol(r.symbol) ?? resolveKnownSymbol(r.symbol) ?? resolveKnownSymbol(r.label);
  if (!symbol) return null;

  const shares = toNum(r.shares);
  if (shares === null || shares <= 0) return null;
  const price = toNum(r.price);
  if (price === null || price < 0) return null;

  const label = (typeof r.label === "string" && r.label.trim() ? r.label.trim() : symbol).slice(0, TRADE_LABEL_MAX);
  const currency = normalizeCurrency(r.currency, symbol);
  const scope: FinzPortfolioScope = r.scope === "shared" ? "shared" : "personal";

  let tradedAt = typeof r.tradedAt === "string" && !Number.isNaN(Date.parse(r.tradedAt)) ? r.tradedAt : nowIso;
  // 미래 일자 방어(오타 등) → now 로.
  if (Date.parse(tradedAt) > Date.parse(nowIso) + 24 * 3600 * 1000) tradedAt = nowIso;
  const note = (typeof r.note === "string" ? r.note : "").slice(0, TRADE_NOTE_MAX);

  return { action, symbol, label, shares: round2(shares), price: round2(price), currency, scope, tradedAt, note };
}

export type FinzSectorSlice = { sector: string; weight: number; amount: number; currency: string; symbols: string[] };

// 섹터별 묶음(차트/분석용) — sectorMap: symbol→섹터(LLM 분류). 주 통화 보유분만, amount/weight 계산.
export function computeSectors(
  holdings: FinzHolding[],
  sectorMap: Record<string, string>,
  basis: "value" | "invested",
  prices?: Record<string, number>,
): FinzSectorSlice[] {
  const open = holdings.filter((h) => h.shares > 0);
  if (open.length === 0) return [];
  const investedByCcy = new Map<string, number>();
  for (const h of open) investedByCcy.set(h.currency, (investedByCcy.get(h.currency) ?? 0) + h.invested);
  let mainCcy = open[0]!.currency;
  let max = -1;
  for (const [c, v] of investedByCcy) if (v > max) ((max = v), (mainCcy = c));

  const bySector = new Map<string, FinzSectorSlice>();
  for (const h of open) {
    if (h.currency !== mainCcy) continue;
    const sector = (sectorMap[h.symbol] || "기타").trim() || "기타";
    const px = prices?.[h.symbol];
    const amount = basis === "value" && typeof px === "number" && Number.isFinite(px) ? h.shares * px : h.invested;
    let s = bySector.get(sector);
    if (!s) {
      s = { sector, weight: 0, amount: 0, currency: mainCcy, symbols: [] };
      bySector.set(sector, s);
    }
    s.amount += amount;
    s.symbols.push(h.label || h.symbol);
  }
  const total = [...bySector.values()].reduce((a, s) => a + s.amount, 0);
  const out = [...bySector.values()].map((s) => ({
    ...s,
    amount: round2(s.amount),
    weight: total > 0 ? round2((s.amount / total) * 100) : 0,
  }));
  return out.sort((a, b) => b.amount - a.amount);
}

// 채팅 타임라인에 쌓이는 "포트폴리오 카드" 메시지 페이로드(생성 시점 스냅샷 — append-only).
export type FinzPortfolioCardPayload = {
  view: "holdings" | "sector";
  scope: FinzPortfolioScope;
  scopeLabel: string; // "지헌님의 포트폴리오" / "방 공동 포트폴리오" 등
  holdings: FinzHolding[];
  summary: FinzCurrencySummary[];
  allocation: FinzAllocationSlice[];
  sectors?: FinzSectorSlice[];
  prices?: Record<string, number>; // symbol→현재가(있을 때) — 종목별 평가손익 렌더용
  priced: boolean; // 현재가 반영 여부
  pricedAt?: string;
  sources?: { title: string; uri: string }[];
  asOfNote?: string; // "일부 종목 현재가 확인 불가" 등
};

// KV/네트워크에서 온 카드 페이로드 관용 검증(서버 생성물 — 얕게). 깨지면 그 메시지만 드롭.
export function isFinzPortfolioCardPayload(v: unknown): v is FinzPortfolioCardPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    (p.view === "holdings" || p.view === "sector") &&
    (p.scope === "personal" || p.scope === "shared") &&
    typeof p.scopeLabel === "string" &&
    Array.isArray(p.holdings) &&
    Array.isArray(p.summary) &&
    Array.isArray(p.allocation) &&
    typeof p.priced === "boolean"
  );
}

export function isFinzTrade(value: unknown): value is FinzTrade {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    t.id.length > 0 &&
    typeof t.ownerId === "string" &&
    typeof t.ownerName === "string" &&
    (t.scope === "personal" || t.scope === "shared") &&
    (t.action === "buy" || t.action === "sell") &&
    typeof t.symbol === "string" &&
    t.symbol.length > 0 &&
    typeof t.label === "string" &&
    typeof t.shares === "number" &&
    t.shares > 0 &&
    typeof t.price === "number" &&
    t.price >= 0 &&
    typeof t.currency === "string" &&
    typeof t.tradedAt === "string" &&
    typeof t.note === "string" &&
    typeof t.createdAt === "string"
  );
}
