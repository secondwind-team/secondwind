import { NextResponse } from "next/server";
import type { RateLimitHit } from "@/lib/common/llm";
import {
  validateTravelInput,
  type TravelInput,
} from "@/lib/common/services/travel";
import { runTravelPlanner } from "@/lib/common/services/travel-planners";
import { getBlockedModels, markBlocked, recordCall } from "@/lib/server/quota-store";

export const runtime = "nodejs";

type TravelBody = { service: "travel"; input: TravelInput };
type Body = TravelBody;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  if (body.service !== "travel") {
    return NextResponse.json({ status: "error", reason: "unknown-service" }, { status: 400 });
  }

  const validation = validateTravelInput(body.input);
  if (!validation.ok) {
    return NextResponse.json({ status: "error", reason: validation.reason }, { status: 400 });
  }
  const input = validation.input;

  // 차단된 모델은 건너뛰어 429 round-trip 절약.
  const skipModels = await getBlockedModels();
  const result = await runTravelPlanner(input, { skipModels });

  // 호출 시도(성공·실패 무관)는 모두 KV 에 기록 — Google 의 RPD 카운터와 align.
  // 성공 호출은 토큰 수를, 429 등 실패는 0 토큰으로 기록한다.
  const hits = "rateLimitHits" in result ? result.rateLimitHits ?? [] : [];
  if (hits.length > 0) {
    await recordRateLimitHits(hits);
    for (const hit of hits) {
      void recordCall(hit.model, 0).catch(() => {});
    }
  }

  if (result.status === "not-configured") {
    return NextResponse.json(
      { status: "not-configured", reason: "GEMINI_API_KEY 가 설정되지 않았습니다." },
      { status: 503 },
    );
  }
  if (result.status === "disabled") {
    return NextResponse.json(result, { status: 503 });
  }
  if (result.status === "error") {
    return NextResponse.json(result, { status: 502 });
  }
  if (result.status === "invalid-response") {
    return NextResponse.json(
      { status: "invalid-response", reason: "LLM 출력 파싱 실패", raw: result.raw },
      { status: 502 },
    );
  }

  // 성공한 호출의 토큰 소비를 KV 에 기록 (fire-and-forget).
  void recordCall(result.llmModel, result.usage.total).catch(() => {});

  return NextResponse.json({
    status: "ok",
    plan: result.plan,
    planningModel: result.planningModel,
    placeStats: result.placeStats,
    promptVersion: result.promptVersion,
    model: result.llmModel,
    usage: result.usage,
  });
}

async function recordRateLimitHits(hits: RateLimitHit[]): Promise<void> {
  await Promise.allSettled(hits.map((h) => markBlocked(h.model, h.dim, h.retryMs)));
}
