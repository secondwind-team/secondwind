// 서버 전용: Upstash Redis 로 Gemini 호출/쿼터 기록을 누적한다.
// KV 환경변수가 없으면 모든 함수가 no-op / null 로 동작해 빌드·런타임을 방해하지 않는다.
//
// 데이터 구조:
//   sw:quota:{model}:calls            LIST  of JSON {ts, tokens}
//   sw:quota:{model}:blocked:{dim}    STRING of JSON {since, until, retryMs}
//                                     dim ∈ rpm | tpm | rpd
//                                     TTL = until - now
//
// TTL 이 곧 "리셋" 이라 별도 cron 불필요.

import { Redis } from "@upstash/redis";
import { GEMINI_MODELS, type GeminiModel } from "@/lib/common/llm";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const CALLS_RETENTION_HOURS = 48;
const CALLS_MAX_ENTRIES = 2000;

export type QuotaDim = "rpm" | "tpm" | "rpd";

export type BlockedInfo = {
  since: number;
  until: number;
  retryMs: number;
};

export type ModelSnapshot = {
  model: GeminiModel;
  rpmUsed: number;
  rpmLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  blocked: Partial<Record<QuotaDim, BlockedInfo>>;
};

export type QuotaSnapshot = {
  byModel: ModelSnapshot[];
  tpmUsed: number;
  tpmLimit: number;
  configured: true;
};

export type QuotaUnavailable = { configured: false };

// 2026-04 기준 Gemini free tier. paid tier 전환 시 값 갱신 필요.
const LIMITS: Record<GeminiModel, { rpm: number; rpd: number; tpm: number }> = {
  "gemini-2.5-flash": { rpm: 10, rpd: 250, tpm: 250_000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1_000, tpm: 250_000 },
};

let cachedClient: Redis | null | undefined;

function getClient(): Redis | null {
  if (cachedClient === undefined) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    cachedClient = url && token ? new Redis({ url, token }) : null;
  }
  return cachedClient;
}

export function isConfigured(): boolean {
  return getClient() !== null;
}

function callsKey(model: GeminiModel): string {
  return `sw:quota:${model}:calls`;
}

function blockedKey(model: GeminiModel, dim: QuotaDim): string {
  return `sw:quota:${model}:blocked:${dim}`;
}

type CallRecord = { ts: number; tokens: number };

export async function recordCall(model: GeminiModel, tokens: number): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  const record: CallRecord = { ts: Date.now(), tokens };
  const key = callsKey(model);
  try {
    await redis.lpush(key, JSON.stringify(record));
    await redis.ltrim(key, 0, CALLS_MAX_ENTRIES - 1);
    await redis.expire(key, CALLS_RETENTION_HOURS * 60 * 60);
  } catch {
    // KV 일시 장애는 무시 — 메인 플로우 보호
  }
}

export async function markBlocked(
  model: GeminiModel,
  dim: QuotaDim,
  retryMs: number,
): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  const now = Date.now();
  const until = dim === "rpd" ? nextPacificMidnightMs(now) : now + retryMs;
  const ttlSec = Math.max(1, Math.ceil((until - now) / 1000));
  const info: BlockedInfo = { since: now, until, retryMs };
  try {
    await redis.set(blockedKey(model, dim), JSON.stringify(info), { ex: ttlSec });
  } catch {
    // 무시
  }
}

// 호출 전 사전 skip 용 — 어떤 dim 이라도 차단된 모델 목록.
// 이미 막힌 모델에 또 호출 보내서 429 받는 round-trip 을 줄인다.
export async function getBlockedModels(): Promise<GeminiModel[]> {
  const redis = getClient();
  if (!redis) return [];
  try {
    const now = Date.now();
    const blocked: GeminiModel[] = [];
    for (const model of GEMINI_MODELS) {
      const [rpm, tpm, rpd] = await Promise.all([
        redis.get(blockedKey(model, "rpm")),
        redis.get(blockedKey(model, "tpm")),
        redis.get(blockedKey(model, "rpd")),
      ]);
      const isLive = (raw: unknown) => {
        const v = parseBlocked(raw);
        return v !== null && v.until > now;
      };
      if (isLive(rpm) || isLive(tpm) || isLive(rpd)) {
        blocked.push(model);
      }
    }
    return blocked;
  } catch {
    return [];
  }
}

export async function getSnapshot(): Promise<QuotaSnapshot | QuotaUnavailable> {
  const redis = getClient();
  if (!redis) return { configured: false };

  try {
    const now = Date.now();
    const pacificMidnight = lastPacificMidnightMs(now);

    const byModel: ModelSnapshot[] = [];
    let tpmUsed = 0;

    for (const model of GEMINI_MODELS) {
      const [rawCalls, blRpm, blTpm, blRpd] = await Promise.all([
        redis.lrange(callsKey(model), 0, -1),
        redis.get(blockedKey(model, "rpm")),
        redis.get(blockedKey(model, "tpm")),
        redis.get(blockedKey(model, "rpd")),
      ]);

      const calls = parseCalls(rawCalls as unknown[]);
      const lastMinute = calls.filter((c) => c.ts >= now - MINUTE_MS);
      const sincePacific = calls.filter((c) => c.ts >= pacificMidnight);
      const tpmForModel = lastMinute.reduce((s, c) => s + c.tokens, 0);
      tpmUsed += tpmForModel;

      const blocked: Partial<Record<QuotaDim, BlockedInfo>> = {};
      const addBlocked = (dim: QuotaDim, raw: unknown) => {
        const v = parseBlocked(raw);
        if (v && v.until > now) blocked[dim] = v;
      };
      addBlocked("rpm", blRpm);
      addBlocked("tpm", blTpm);
      addBlocked("rpd", blRpd);

      byModel.push({
        model,
        rpmUsed: lastMinute.length,
        rpmLimit: LIMITS[model].rpm,
        rpdUsed: sincePacific.length,
        rpdLimit: LIMITS[model].rpd,
        blocked,
      });
    }

    return {
      byModel,
      tpmUsed,
      tpmLimit: LIMITS[GEMINI_MODELS[0]].tpm,
      configured: true,
    };
  } catch {
    return { configured: false };
  }
}

function parseCalls(raw: unknown[]): CallRecord[] {
  const out: CallRecord[] = [];
  for (const item of raw) {
    const parsed = parseJsonSafe(item);
    if (!parsed) continue;
    if (typeof parsed.ts === "number" && typeof parsed.tokens === "number") {
      out.push({ ts: parsed.ts, tokens: parsed.tokens });
    }
  }
  return out;
}

function parseBlocked(raw: unknown): BlockedInfo | null {
  const parsed = parseJsonSafe(raw);
  if (!parsed) return null;
  if (
    typeof parsed.since !== "number" ||
    typeof parsed.until !== "number" ||
    typeof parsed.retryMs !== "number"
  ) {
    return null;
  }
  return { since: parsed.since, until: parsed.until, retryMs: parsed.retryMs };
}

function parseJsonSafe(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// --- Pacific midnight ---
// Gemini RPD 는 Pacific 자정 (America/Los_Angeles 00:00) 에 리셋.

function getPacificParts(atMs: number): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const d = new Date(atMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const rawHour = get("hour");
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: rawHour === 24 ? 0 : rawHour, // 일부 환경에서 "24" 반환 케이스
    mi: get("minute"),
    s: get("second"),
  };
}

function laWallToUtcMs(y: number, m: number, d: number, h: number, mi: number, s: number, refMs: number): number {
  // LA wall clock "y-m-d h:mi:s" 를 UTC ms 로 환산.
  // 현재 LA 오프셋은 refMs 시점 기준. Date.UTC 값과 LA 를 비교해 오프셋을 도출.
  const utcFromLa = Date.UTC(y, m - 1, d, h, mi, s);
  const refParts = getPacificParts(refMs);
  const refUtcFromLa = Date.UTC(
    refParts.y,
    refParts.m - 1,
    refParts.d,
    refParts.h,
    refParts.mi,
    refParts.s,
  );
  const offsetMs = refMs - refUtcFromLa;
  return utcFromLa + offsetMs;
}

export function lastPacificMidnightMs(nowMs = Date.now()): number {
  const { y, m, d } = getPacificParts(nowMs);
  return laWallToUtcMs(y, m, d, 0, 0, 0, nowMs);
}

export function nextPacificMidnightMs(nowMs = Date.now()): number {
  const todayMidnight = lastPacificMidnightMs(nowMs);
  return todayMidnight + DAY_MS;
}
