import { afterEach, describe, expect, it, vi } from "vitest";

// finz "오늘의 우정주" 생성 실패 회귀 방지:
// gemini-2.5-flash 의 thinking 토큰이 maxOutputTokens 를 다 먹어 본문 JSON 이 잘리던 버그.
// 수정: LlmCallInput.thinkingBudget 를 generationConfig.thinkingConfig 로 전달해 thinking 을 끈다.
describe("callLlm — thinkingBudget plumbing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadWithFetchCapture() {
    vi.stubEnv("GEMINI_API_KEY", "test-key-abcdefghij");
    vi.resetModules();
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        requests.push(JSON.parse(init.body) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const { callLlm } = await import("./llm");
    return { callLlm, requests };
  }

  it("thinkingBudget: 0 을 주면 첫 모델 요청의 generationConfig.thinkingConfig 에 실린다", async () => {
    const { callLlm, requests } = await loadWithFetchCapture();
    const res = await callLlm({ system: "s", user: "u", thinkingBudget: 0 });
    expect(res.status).toBe("ok");
    const body = requests[0];
    if (!body) throw new Error("요청이 캡처되지 않았다");
    const genConfig = body.generationConfig as Record<string, unknown>;
    expect(genConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("thinkingBudget 미지정 시 thinkingConfig 가 붙지 않는다 (travel 등 기존 동작 보존)", async () => {
    const { callLlm, requests } = await loadWithFetchCapture();
    await callLlm({ system: "s", user: "u" });
    const body = requests[0];
    if (!body) throw new Error("요청이 캡처되지 않았다");
    const genConfig = body.generationConfig as Record<string, unknown>;
    expect(genConfig.thinkingConfig).toBeUndefined();
  });
});
