import { NextResponse } from "next/server";
import type { RateLimitHit } from "@/lib/common/llm";
import {
  normalizeTravelInput,
  type TravelInput,
} from "@/lib/common/services/travel";
import { runTravelPlanner } from "@/lib/common/services/travel-planners";
import { markBlocked, recordCall } from "@/lib/server/quota-store";

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

  const input = normalizeTravelInput(body.input);
  if (!input) {
    return NextResponse.json({ status: "error", reason: "invalid-input" }, { status: 400 });
  }

  const result = await runTravelPlanner(input);

  // KV 에 rate-limit 소진 기록 (fire-and-forget).
  if (result.status === "ok" && result.rateLimitHits) {
    void recordRateLimitHits(result.rateLimitHits);
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
