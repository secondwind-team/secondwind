import { env, assertServerEnv } from "./env";

export type LlmCallInput = {
  system: string;
  user: string;
  maxTokens?: number;
};

// 순서 = primary → fallback. 429/503 에만 fallback 하며,
// for-of 단방향 순회라서 A→B→A 순환이 구조적으로 불가능.
export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];

export type LlmResult =
  | { status: "ok"; text: string; promptVersion: string; model: GeminiModel }
  | { status: "disabled"; reason: string }
  | { status: "not-configured" }
  | { status: "error"; reason: string; model?: GeminiModel };

const DEFAULT_TIMEOUT_MS = 60_000;

export async function callLlm(input: LlmCallInput, signal?: AbortSignal): Promise<LlmResult> {
  assertServerEnv();

  if (env.geminiDisabled) {
    return { status: "disabled", reason: "GEMINI_DISABLED=1 — 점검 중" };
  }
  if (!env.geminiApiKey) {
    return { status: "not-configured" };
  }

  let lastError: LlmResult = { status: "error", reason: "no-attempt" };
  for (const model of GEMINI_MODELS) {
    if (signal?.aborted) {
      return { status: "error", reason: "aborted", model };
    }
    const result = await callGemini(model, input, signal);
    if (result.status === "ok") return result;
    lastError = result;
    if (!isTransientUpstream(result)) break;
  }
  return lastError;
}

function isTransientUpstream(result: LlmResult): boolean {
  if (result.status !== "error") return false;
  return result.reason === "upstream 429" || result.reason === "upstream 503";
}

async function callGemini(
  model: GeminiModel,
  input: LlmCallInput,
  signal?: AbortSignal,
): Promise<LlmResult> {
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
          temperature: 0.6,
          maxOutputTokens: input.maxTokens ?? 2048,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: "error", reason: `upstream ${res.status}`, model };
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      return { status: "error", reason: "empty response", model };
    }
    return { status: "ok", text, promptVersion: env.promptVersion, model };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    return { status: "error", reason, model };
  } finally {
    clearTimeout(timeout);
  }
}
