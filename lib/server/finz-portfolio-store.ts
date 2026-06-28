// 서버 전용: 방별 포트폴리오 "거래(매수/매도)"를 Upstash Redis LIST 로 append-only 보관한다.
//  - sw:finz:portfolio:<roomId> = 거래 JSON LIST(append-only). 보유 현황은 저장하지 않고 거래에서 파생 계산.
//
// 채팅 LIST 와 같은 철학. add 는 단일 rpush(원자적). 수정/삭제는 빈도가 낮고(설정 화면) 전체 재기록 —
// 2인/소그룹 기준 last-write-wins 수용(동시 add 와의 레이스는 거의 없음, 문서화).

import {
  isFinzTrade,
  MAX_TRADES_PER_ROOM,
  type FinzTrade,
} from "@/lib/common/services/finz-portfolio";
import { FINZ_GROUP_TTL_SECONDS, getClient, parseJsonSafe } from "./finz-group-store";

// 포트폴리오는 방(30일)보다 오래 — 60일, 쓰기마다 갱신. 방이 사라지면 호출부(라우트)가 멤버 가드로 차단.
const PORTFOLIO_TTL_SECONDS = Math.max(FINZ_GROUP_TTL_SECONDS, 60 * 24 * 60 * 60);

function portfolioKey(roomId: string): string {
  return `sw:finz:portfolio:${roomId}`;
}

function newId(): string {
  return crypto.randomUUID();
}

function hydrate(raw: unknown[]): FinzTrade[] {
  const out: FinzTrade[] = [];
  for (const el of raw) {
    const obj = parseJsonSafe(el);
    if (obj && isFinzTrade(obj)) out.push(obj as FinzTrade);
  }
  return out;
}

// 거래 추가(append). id/createdAt 은 서버가 채운다. 상한 초과면 limit.
export async function addTrade(
  roomId: string,
  input: Omit<FinzTrade, "id" | "createdAt"> & { createdAt?: string },
): Promise<{ status: "ok"; trade: FinzTrade } | { status: "limit" } | { status: "error" }> {
  const redis = getClient();
  if (!redis) return { status: "error" };
  const len = await redis.llen(portfolioKey(roomId));
  if (len >= MAX_TRADES_PER_ROOM) return { status: "limit" };

  const trade: FinzTrade = {
    ...input,
    id: newId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  if (!isFinzTrade(trade)) return { status: "error" };
  await redis.rpush(portfolioKey(roomId), JSON.stringify(trade));
  await redis.expire(portfolioKey(roomId), PORTFOLIO_TTL_SECONDS);
  return { status: "ok", trade };
}

export async function listTrades(roomId: string): Promise<FinzTrade[]> {
  const redis = getClient();
  if (!redis) return [];
  const raw = await redis.lrange(portfolioKey(roomId), 0, -1);
  return hydrate(raw);
}

// 전체 재기록(수정/삭제 공용). 빈도 낮음 — del 후 rpush 일괄.
async function rewrite(roomId: string, trades: FinzTrade[]): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  const key = portfolioKey(roomId);
  const pipe = redis.pipeline();
  pipe.del(key);
  if (trades.length > 0) pipe.rpush(key, ...trades.map((t) => JSON.stringify(t)));
  pipe.expire(key, PORTFOLIO_TTL_SECONDS);
  await pipe.exec();
}

const EDITABLE_FIELDS = ["action", "symbol", "label", "shares", "price", "currency", "scope", "tradedAt", "note"] as const;

export async function updateTrade(
  roomId: string,
  tradeId: string,
  patch: Partial<Pick<FinzTrade, (typeof EDITABLE_FIELDS)[number]>>,
): Promise<FinzTrade | null> {
  const trades = await listTrades(roomId);
  const idx = trades.findIndex((t) => t.id === tradeId);
  if (idx < 0) return null;
  const merged: FinzTrade = { ...trades[idx]!, ...patch };
  if (!isFinzTrade(merged)) return null;
  trades[idx] = merged;
  await rewrite(roomId, trades);
  return merged;
}

export async function deleteTrade(roomId: string, tradeId: string): Promise<boolean> {
  const trades = await listTrades(roomId);
  const next = trades.filter((t) => t.id !== tradeId);
  if (next.length === trades.length) return false; // 없었음
  await rewrite(roomId, next);
  return true;
}
