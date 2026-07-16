import { afterEach, describe, expect, it, vi } from "vitest";
import { yahooFinzPriceProvider } from "./finz-price-provider";

const asset = { symbol: "NVDA", name: "NVIDIA", assetType: "stock" as const, aliases: [] };

afterEach(() => vi.unstubAllGlobals());

function response(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) };
}

it("리뷰 시각 이하의 마지막 유효 시가를 반올림해 선택", async () => {
  const fetch = vi.fn().mockResolvedValue(response({
    chart: { result: [{
      timestamp: [1785283200, 1785369600, 1785456000],
      indicators: { quote: [{ open: [100.126, null, 120] }] },
      meta: { currency: "KRW", symbol: "005930.KS" },
    }] },
  }));
  vi.stubGlobal("fetch", fetch);

  const point = await yahooFinzPriceProvider.getOpenPrice(asset, "2026-07-30T12:00:00.000Z");
  expect(point).toMatchObject({ price: 100.13, currency: "KRW", source: "yahoo:005930.KS:1d-open" });
  const url = fetch.mock.calls[0]?.[0] as URL;
  expect(url.searchParams.get("interval")).toBe("1d");
});

it("기간 시작 이후 첫 확보 가능 시가를 선택", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
    chart: { result: [{ timestamp: [1785283200, 1785369600], indicators: { quote: [{ open: [90, 95] }] } }] },
  })));
  await expect(yahooFinzPriceProvider.getFirstAvailableOpenPrice(
    asset,
    "2026-07-29T12:00:00.000Z",
    "2026-07-31T12:00:00.000Z",
  )).resolves.toMatchObject({ price: 95, currency: "USD", source: "yahoo:NVDA:1d-open" });
});

it("HTTP 오류는 가격 없음으로 degrade", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, false)));
  await expect(yahooFinzPriceProvider.getOpenPrice(asset, "2026-07-31T12:00:00.000Z")).resolves.toBeNull();
});

it("network/JSON 예외는 가격 없음으로 degrade", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  await expect(yahooFinzPriceProvider.getOpenPrice(asset, "2026-07-31T12:00:00.000Z")).resolves.toBeNull();

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockRejectedValue(new Error("bad json")) }));
  await expect(yahooFinzPriceProvider.getOpenPrice(asset, "2026-07-31T12:00:00.000Z")).resolves.toBeNull();
});

it("누락/비정상 candle은 건너뛰고 결과가 없으면 null", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
    chart: {
      result: [{
        timestamp: [1785283200, 1785369600],
        indicators: { quote: [{ open: [Number.NaN, null] }] },
      }],
    },
  })));
  await expect(yahooFinzPriceProvider.getOpenPrice(asset, "2026-07-31T12:00:00.000Z")).resolves.toBeNull();
});
