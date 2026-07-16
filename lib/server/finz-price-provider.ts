import {
  type FinzAssetCatalogItem,
  type FinzPricePoint,
  type FinzPriceProvider,
} from "@/lib/common/services/finz-monthly-review";

const DAY_MS = 24 * 60 * 60 * 1000;

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
        }>;
      };
      meta?: {
        currency?: string;
        symbol?: string;
      };
    }>;
  };
};

export const yahooFinzPriceProvider: FinzPriceProvider = {
  async getOpenPrice(asset, at) {
    const candles = await fetchYahooDailyOpenCandles(asset, daysBefore(at, 45), daysAfter(at, 1));
    return candles
      .filter((candle) => Date.parse(candle.observedAt) <= Date.parse(at))
      .at(-1) ?? null;
  },

  async getFirstAvailableOpenPrice(asset, from, to) {
    const candles = await fetchYahooDailyOpenCandles(asset, from, daysAfter(to, 1));
    return candles.find((candle) => Date.parse(candle.observedAt) >= Date.parse(from)) ?? null;
  },
};

async function fetchYahooDailyOpenCandles(
  asset: FinzAssetCatalogItem,
  from: string,
  to: string,
): Promise<FinzPricePoint[]> {
  const symbol = asset.priceSymbol ?? asset.symbol;
  const period1 = Math.floor(Date.parse(from) / 1000);
  const period2 = Math.floor(Date.parse(to) / 1000);
  if (!Number.isFinite(period1) || !Number.isFinite(period2)) return [];

  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", "1d");

  let json: YahooChartResponse;
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "secondwind-finz/0.1",
      },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    json = (await res.json()) as YahooChartResponse;
  } catch {
    // 외부 시세 장애가 월간 리뷰 전체를 깨지 않게 가격 없음으로 처리한다.
    return [];
  }
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const opens = result?.indicators?.quote?.[0]?.open ?? [];
  const currency = result?.meta?.currency ?? asset.currency ?? "USD";
  const sourceSymbol = result?.meta?.symbol ?? symbol;

  return timestamps
    .map((timestamp, index): FinzPricePoint | null => {
      const price = opens[index];
      if (typeof price !== "number" || !Number.isFinite(price)) return null;
      return {
        price: Math.round(price * 100) / 100,
        currency,
        observedAt: new Date(timestamp * 1000).toISOString(),
        source: `yahoo:${sourceSymbol}:1d-open`,
      };
    })
    .filter((point): point is FinzPricePoint => point !== null);
}

function daysBefore(value: string, days: number): string {
  return new Date(Date.parse(value) - days * DAY_MS).toISOString();
}

function daysAfter(value: string, days: number): string {
  return new Date(Date.parse(value) + days * DAY_MS).toISOString();
}
