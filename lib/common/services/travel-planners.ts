import { callLlm, type GeminiModel, type GeminiUsage, type RateLimitHit } from "@/lib/common/llm";
import {
  buildTravelPrompt,
  parseTravelPlan,
  TRAVEL_PLAN_SCHEMA,
  type PlaceStats,
  type PlanningModel,
  type TravelInput,
  type TravelPlan,
} from "./travel";
import { computePlaceStats, enrichPlan } from "./travel-enrich";

export type TravelPlannerResult =
  | {
      status: "ok";
      plan: TravelPlan;
      planningModel: PlanningModel;
      llmModel: GeminiModel;
      promptVersion: string;
      usage: GeminiUsage;
      placeStats: PlaceStats;
      rateLimitHits?: RateLimitHit[];
    }
  | { status: "not-configured" }
  | { status: "disabled"; reason: string }
  | { status: "invalid-response"; raw: string }
  | { status: "error"; reason: string; model?: string };

type PlannerConfig = {
  temperature: number;
  repairedPlaces: number;
};

const PLANNER_CONFIG: Record<PlanningModel, PlannerConfig> = {
  classic: { temperature: 0.6, repairedPlaces: 0 },
  balanced: { temperature: 0.35, repairedPlaces: 0 },
  verified: { temperature: 0.2, repairedPlaces: 0 },
};

export async function runTravelPlanner(input: TravelInput): Promise<TravelPlannerResult> {
  const config = PLANNER_CONFIG[input.planningModel];
  const { system, user } = buildTravelPrompt(input);
  const result = await callLlm({
    system,
    user,
    // 3박+많은 item+긴 rationale 케이스에서 6144 가 빡빡해 truncation 이 났던 정황이 있어 8192 로 상향.
    maxTokens: 8192,
    responseSchema: TRAVEL_PLAN_SCHEMA,
    temperature: config.temperature,
  });

  if (result.status === "not-configured" || result.status === "disabled") return result;
  if (result.status === "error") return { status: "error", reason: result.reason, model: result.model };

  const plan = parseTravelPlan(result.text);
  if (!plan) return { status: "invalid-response", raw: result.text.slice(0, 500) };

  await enrichPlan(plan, input.destination);

  return {
    status: "ok",
    plan,
    planningModel: input.planningModel,
    llmModel: result.model,
    promptVersion: result.promptVersion,
    usage: result.usage,
    placeStats: computePlaceStats(plan, config.repairedPlaces),
    rateLimitHits: result.rateLimitHits,
  };
}
