// 서버 전용: 종목명 → TradingView 심볼 "학습 캐시"(Upstash Redis).
// 내장 사전(finz-portfolio 의 KNOWN_SYMBOLS)에 없는 종목은 LLM 이 심볼을 찾아오고, 그 결과를 여기에 저장해
// 다음부터는 LLM 없이(그리고 항상 같은 심볼로 — 키 일관성) 재사용한다.
//
// 해석 순서(호출부): 내장 사전 → 이 캐시 → LLM. LLM 으로 새로 찾으면 cacheSymbol 로 적재.

import { getClient } from "./finz-group-store";

const SYMBOL_TTL_SECONDS = 180 * 24 * 60 * 60; // 180일(쓰기마다 갱신 → 자주 쓰는 종목은 사실상 영구)

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").slice(0, 40);
}
function symKey(name: string): string {
  return `sw:finz:sym:${normName(name)}`;
}

// TradingView 심볼 형태 검증(거래소:티커 등 허용 문자만, 비면 무효).
function cleanSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9:._-]/g, "").slice(0, 24);
  return s.length > 0 ? s : null;
}

// 학습된 심볼 조회. 없거나 미설정이면 null.
export async function getCachedSymbol(name: string): Promise<string | null> {
  const redis = getClient();
  if (!redis || !name.trim()) return null;
  const v = await redis.get(symKey(name));
  return cleanSymbol(v);
}

// 종목명→심볼 학습 저장(best-effort). TTL 갱신.
export async function cacheSymbol(name: string, symbol: string): Promise<void> {
  const redis = getClient();
  const sym = cleanSymbol(symbol);
  if (!redis || !name.trim() || !sym) return;
  await redis.set(symKey(name), sym, { ex: SYMBOL_TTL_SECONDS });
}
