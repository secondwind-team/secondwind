import { NextResponse } from "next/server";
import { callLlm } from "@/lib/common/llm";
import {
  buildTravelPrompt,
  parseTravelPlan,
  partyTotal,
  USER_PROMPT_MAX,
  type TravelInput,
  type TravelParty,
} from "@/lib/common/services/travel";
import { enrichPlan } from "@/lib/common/services/travel-enrich";

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

  const { system, user } = buildTravelPrompt(input);
  const result = await callLlm({ system, user, maxTokens: 4096 });

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

  const plan = parseTravelPlan(result.text);
  if (!plan) {
    return NextResponse.json(
      { status: "invalid-response", reason: "LLM 출력 파싱 실패", raw: result.text.slice(0, 500) },
      { status: 502 },
    );
  }

  await enrichPlan(plan, input.destination);

  return NextResponse.json({
    status: "ok",
    plan,
    promptVersion: result.promptVersion,
    model: result.model,
  });
}

function normalizePartyCount(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(Math.min(n, 20));
}

function normalizeTravelInput(raw: unknown): TravelInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const destination = typeof r.destination === "string" ? r.destination.trim().slice(0, 80) : "";
  const startDate = typeof r.startDate === "string" ? r.startDate : "";
  const endDate = typeof r.endDate === "string" ? r.endDate : "";
  const prompt = typeof r.prompt === "string" ? r.prompt.trim().slice(0, USER_PROMPT_MAX) : "";

  const partyRaw = (r.party ?? {}) as Record<string, unknown>;
  const party: TravelParty = {
    adults: normalizePartyCount(partyRaw.adults),
    teens: normalizePartyCount(partyRaw.teens),
    kids: normalizePartyCount(partyRaw.kids),
    infants: normalizePartyCount(partyRaw.infants),
  };

  if (!destination) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  if (new Date(endDate) < new Date(startDate)) return null;
  const total = partyTotal(party);
  if (total < 1 || total > 40) return null;
  if (party.adults < 1 && (party.kids > 0 || party.infants > 0)) return null;

  return { destination, startDate, endDate, party, prompt };
}
