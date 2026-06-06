import { NextResponse } from "next/server";
import {
  FINZ_DAILY_PICK_SCHEMA,
  buildFinzProfile,
  isFinzDailyPick,
  type FinzProfile,
} from "@/lib/common/services/finz";
import { callLlm } from "@/lib/common/llm";
import { getCurrentUser } from "@/lib/server/auth";
import {
  getDailyPick,
  getFinzProfile,
  upsertDailyPick,
} from "@/lib/server/finz-store";
import { getBlockedModels, recordCall } from "@/lib/server/quota-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const stored = await getDailyPick({
    userEmail: user.email,
    pickDate: todayKst(),
  });
  if (!stored) return NextResponse.json({ status: "empty" });

  return NextResponse.json({ status: "ok", dailyPick: stored });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  let force = false;
  try {
    const body = (await req.json().catch(() => ({}))) as { force?: unknown };
    force = body.force === true;
  } catch {
    force = false;
  }

  const pickDate = todayKst();
  if (!force) {
    const existing = await getDailyPick({ userEmail: user.email, pickDate });
    if (existing) return NextResponse.json({ status: "ok", dailyPick: existing });
  }

  const storedProfile = await getFinzProfile(user.email);
  if (!storedProfile) {
    return NextResponse.json({ status: "error", reason: "profile-required" }, { status: 400 });
  }

  const profile = buildFinzProfile(storedProfile.selectedCardIds);
  if (!profile) {
    return NextResponse.json({ status: "error", reason: "profile-invalid" }, { status: 400 });
  }

  const skipModels = await getBlockedModels();
  const result = await callLlm(
    {
      system: FINZ_PICK_SYSTEM_PROMPT,
      user: buildPickPrompt(profile),
      temperature: 0.75,
      maxTokens: 1800,
      responseSchema: FINZ_DAILY_PICK_SCHEMA,
    },
    { skipModels },
  );

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

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return NextResponse.json(
      { status: "invalid-response", reason: "finz-pick-json-parse-failed" },
      { status: 502 },
    );
  }
  if (!isFinzDailyPick(parsed)) {
    return NextResponse.json(
      { status: "invalid-response", reason: "finz-pick-schema-mismatch" },
      { status: 502 },
    );
  }

  void recordCall(result.model, result.usage.total).catch(() => {});
  const dailyPick = await upsertDailyPick({
    userEmail: user.email,
    pickDate,
    profile,
    pick: parsed,
    model: result.model,
    promptVersion: result.promptVersion,
    usage: result.usage,
  });

  return NextResponse.json({ status: "ok", dailyPick });
}

const FINZ_PICK_SYSTEM_PROMPT = [
  "너는 FINZ의 진행자다.",
  "FINZ는 투자 조언이나 매매 추천을 제공하지 않는다.",
  "목표는 사용자의 투자 취향 캐릭터를 바탕으로 오늘 친구들과 이야기할 종목 또는 테마 하나를 고르고, 대화가 시작되게 만드는 것이다.",
  "종목을 고를 수 있지만 확신하거나 매수/매도 지시처럼 쓰지 마라.",
  "최신 시세나 사실을 모르면 단정하지 말고, 확인해야 할 관점으로 표현하라.",
  "한국어로 답하라.",
].join("\n");

function buildPickPrompt(profile: FinzProfile): string {
  return JSON.stringify(
    {
      instruction:
        "아래 FINZ 프로필에 맞춰 오늘 이야기할 우정주 또는 테마 하나를 골라라. 결과는 JSON schema에 맞춰라.",
      profile: {
        selectedCards: profile.selectedCards.map((card) => card.label),
        selectedTags: profile.selectedTags,
        character: profile.character,
      },
      constraints: [
        "kind는 실제 상장사 이야기가 적합하면 stock, 더 안전하게 대화할 주제가 적합하면 theme를 선택한다.",
        "openingQuestions는 2~3개.",
        "conversationSeeds는 3~5개.",
        "caveats에는 투자 조언이 아니라 대화 소재라는 문장을 반드시 포함한다.",
        "rolePrompt는 사용자의 캐릭터 클래스가 대화에서 맡을 관점으로 쓴다.",
      ],
    },
    null,
    2,
  );
}

function todayKst(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}
