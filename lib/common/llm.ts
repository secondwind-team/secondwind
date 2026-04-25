import { env, assertServerEnv } from "./env";

export type LlmCallInput = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  // OpenAPI 3.0 subset (Gemini responseSchema). 지정 시 constrained decoding 으로
  // 출력이 schema 에 맞춰지므로 JSON.parse 실패 · 필드 누락 · 타입 불일치가 거의 사라진다.
  // 단, maxOutputTokens 에 닿아 출력이 잘리는 truncation 은 schema 로 못 막는다.
  responseSchema?: object;
};

// 순서 = primary → fallback. 429/503 에만 fallback 하며,
// for-of 단방향 순회라서 A→B→A 순환이 구조적으로 불가능.
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];

export type GeminiUsage = {
  prompt: number;
  output: number;
  thoughts?: number;
  total: number;
};

export type QuotaDim = "rpm" | "tpm" | "rpd";

export type RateLimitHit = {
  model: GeminiModel;
  dim: QuotaDim;
  retryMs: number;
};

// callLlm 한 번 동안 발생한 모든 429 를 모아서 반환한다.
// primary 가 429 후 fallback 이 성공해도 primary 소진은 KV 에 기록돼야 하기 때문.
export type LlmResult =
  | {
      status: "ok";
      text: string;
      promptVersion: string;
      model: GeminiModel;
      usage: GeminiUsage;
      rateLimitHits?: RateLimitHit[];
    }
  | { status: "disabled"; reason: string }
  | { status: "not-configured" }
  | {
      status: "error";
      reason: string;
      model?: GeminiModel;
      rateLimitHits?: RateLimitHit[];
    };

const DEFAULT_TIMEOUT_MS = 60_000;

export type CallLlmOptions = {
  signal?: AbortSignal;
  // 이미 차단(rpm/tpm/rpd)된 것이 확실한 모델은 건너뛰어 429 round-trip 을 아낀다.
  skipModels?: ReadonlyArray<GeminiModel>;
};

export async function callLlm(
  input: LlmCallInput,
  opts: CallLlmOptions = {},
): Promise<LlmResult> {
  assertServerEnv();

  if (env.geminiDisabled) {
    return { status: "disabled", reason: "GEMINI_DISABLED=1 — 점검 중" };
  }
  if (!env.geminiApiKey) {
    return { status: "not-configured" };
  }

  const skipSet = new Set(opts.skipModels ?? []);
  const hits: RateLimitHit[] = [];
  let lastError: LlmResult = { status: "error", reason: "no-attempt" };
  for (const model of GEMINI_MODELS) {
    if (skipSet.has(model)) continue;
    if (opts.signal?.aborted) {
      return attachHits({ status: "error", reason: "aborted", model }, hits);
    }
    const outcome = await callGemini(model, input, opts.signal);
    if (outcome.status === "error" && outcome._rateLimit) {
      hits.push({ model, dim: outcome._rateLimit.dim, retryMs: outcome._rateLimit.retryMs });
    }
    const { _rateLimit: _drop, ...publicResult } = outcome;
    if (publicResult.status === "ok") return attachHits(publicResult as LlmResult, hits);
    lastError = publicResult as LlmResult;
    if (!isTransientUpstream(publicResult as LlmResult)) break;
  }
  if (lastError.status === "error" && lastError.reason === "no-attempt") {
    return attachHits({ status: "error", reason: "all-models-blocked" }, hits);
  }
  return attachHits(lastError, hits);
}

function attachHits(result: LlmResult, hits: RateLimitHit[]): LlmResult {
  if (hits.length === 0) return result;
  if (result.status === "ok" || result.status === "error") {
    return { ...result, rateLimitHits: hits };
  }
  return result;
}

function isTransientUpstream(result: LlmResult): boolean {
  if (result.status !== "error") return false;
  return result.reason === "upstream 429" || result.reason === "upstream 503";
}

// Gemini 429 응답 body 에서 어떤 한도가 터졌는지 + 복구 시각 추출.
// 응답 형식은 https://cloud.google.com/apis/design/errors (google.rpc 표준) 따름.
async function parseRateLimit(res: Response): Promise<{ dim: QuotaDim; retryMs: number } | undefined> {
  try {
    const body = (await res.json()) as {
      error?: {
        details?: Array<{
          "@type"?: string;
          violations?: Array<{ quotaId?: string; quotaMetric?: string }>;
          retryDelay?: string;
        }>;
      };
    };
    const details = body.error?.details ?? [];
    const quotaDetail = details.find((d) => d["@type"]?.includes("QuotaFailure"));
    const retryDetail = details.find((d) => d["@type"]?.includes("RetryInfo"));

    const dim = pickDim(quotaDetail?.violations ?? []);
    const retryMs = parseRetryDelay(retryDetail?.retryDelay) ?? 60_000;
    if (!dim) return undefined;
    return { dim, retryMs };
  } catch {
    return undefined;
  }
}

function pickDim(
  violations: Array<{ quotaId?: string; quotaMetric?: string }>,
): QuotaDim | undefined {
  for (const v of violations) {
    const id = (v.quotaId ?? v.quotaMetric ?? "").toLowerCase();
    if (id.includes("perday")) return "rpd";
    if (id.includes("tokens") && id.includes("perminute")) return "tpm";
    if (id.includes("requests") && id.includes("perminute")) return "rpm";
  }
  return undefined;
}

function parseRetryDelay(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // 형식: "15s", "1.234s", "60s" 등
  const match = /^([\d.]+)s$/.exec(raw);
  if (!match) return undefined;
  const sec = Number(match[1]);
  if (!Number.isFinite(sec)) return undefined;
  return Math.round(sec * 1000);
}

// 내부용 — 한 모델에 1회 요청. 429 body 파싱 결과를 _rateLimit 로 실어 보냄 (caller 전용).
type CallOutcome = LlmResult & { _rateLimit?: { dim: QuotaDim; retryMs: number } };

async function callGemini(
  model: GeminiModel,
  input: LlmCallInput,
  signal?: AbortSignal,
): Promise<CallOutcome> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), DEFAULT_TIMEOUT_MS);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  try {
    const res = await fetch(`${url}?key=${encodeURIComponent(env.geminiApiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
        generationConfig: {
          temperature: input.temperature ?? 0.6,
          maxOutputTokens: input.maxTokens ?? 2048,
          responseMimeType: "application/json",
          ...(input.responseSchema ? { responseSchema: input.responseSchema } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const base: CallOutcome = { status: "error", reason: `upstream ${res.status}`, model };
      if (res.status === 429) {
        const rateLimit = await parseRateLimit(res);
        if (rateLimit) base._rateLimit = rateLimit;
      }
      return base;
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      return { status: "error", reason: "empty response", model };
    }
    const um = json.usageMetadata ?? {};
    const usage: GeminiUsage = {
      prompt: um.promptTokenCount ?? 0,
      output: um.candidatesTokenCount ?? 0,
      total: um.totalTokenCount ?? 0,
      ...(typeof um.thoughtsTokenCount === "number" ? { thoughts: um.thoughtsTokenCount } : {}),
    };
    return { status: "ok", text, promptVersion: env.promptVersion, model, usage };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    return { status: "error", reason, model };
  } finally {
    clearTimeout(timeout);
  }
}
