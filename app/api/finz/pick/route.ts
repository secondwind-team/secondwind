import { NextResponse } from "next/server";
import {
  FINZ_DAILY_PICK_SCHEMA,
  buildFinzFallbackPick,
  buildFinzProfile,
  finzProfileKey,
  isFinzDailyPick,
  type FinzDailyPick,
  type FinzProfile,
} from "@/lib/common/services/finz";
import { callLlm } from "@/lib/common/llm";
import { getCurrentUser } from "@/lib/server/auth";
import {
  getDailyPick,
  getFinzProfile,
  upsertDailyPick,
} from "@/lib/server/finz-store";
import { getBlockedModels, recordCall, recordLlmQuota } from "@/lib/server/quota-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const storedProfile = await getFinzProfile(user.email);
  if (!storedProfile) return NextResponse.json({ status: "empty" });

  const profile = buildFinzProfile(storedProfile.selectedCardIds);
  if (!profile) return NextResponse.json({ status: "empty" });

  const stored = await getDailyPick({
    userEmail: user.email,
    pickDate: todayKst(),
    profileKey: finzProfileKey(profile),
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
  const storedProfile = await getFinzProfile(user.email);
  if (!storedProfile) {
    return NextResponse.json({ status: "error", reason: "profile-required" }, { status: 400 });
  }

  const profile = buildFinzProfile(storedProfile.selectedCardIds);
  if (!profile) {
    return NextResponse.json({ status: "error", reason: "profile-invalid" }, { status: 400 });
  }
  const profileKey = finzProfileKey(profile);

  const existing = await getDailyPick({ userEmail: user.email, pickDate, profileKey });
  if (!force && existing) return NextResponse.json({ status: "ok", dailyPick: existing });

  const skipModels = await getBlockedModels();
  const result = await callLlm(
    {
      system: FINZ_PICK_SYSTEM_PROMPT,
      user: buildPickPrompt(profile, {
        previousPick: force ? existing?.pick ?? null : null,
        variationSeed: crypto.randomUUID(),
      }),
      temperature: 0.75,
      maxTokens: 1800,
      responseSchema: FINZ_DAILY_PICK_SCHEMA,
      // gemini-2.5-flash 의 thinking 이 maxOutputTokens 를 다 먹어 JSON 이 잘리는 것을 막는다.
      // 우정주 픽은 구조화 JSON 생성이라 thinking 이 불필요하다.
      thinkingBudget: 0,
    },
    { skipModels },
  );
  void recordLlmQuota(result).catch(() => {}); // 429 를 KV 에 기록 → 다음 호출 사전 skip

  if (result.status === "ok") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = null;
    }
    if (isFinzDailyPick(parsed)) {
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
    console.warn("[finz/pick] LLM 응답 파싱/스키마 실패 — fallback 픽 사용");
  } else {
    console.warn(`[finz/pick] LLM 호출 실패(${result.status}) — fallback 픽 사용`);
  }

  // AI 실패 시: 같은 날 저장된 픽이 있으면 다운그레이드하지 않고 그대로 보여주고,
  // 없으면 프로필 기반 deterministic 폴백 픽으로 대화가 끊기지 않게 한다.
  // (폴백은 저장하지 않아 다음 시도에서 다시 AI 생성을 시도한다.)
  if (existing) {
    return NextResponse.json({ status: "ok", dailyPick: existing });
  }
  const fallbackPick = buildFinzFallbackPick(profile);
  return NextResponse.json({ status: "ok", fallback: true, dailyPick: { pick: fallbackPick } });
}

const FINZ_PICK_SYSTEM_PROMPT = [
  "너는 FINZ의 진행자다.",
  "FINZ는 투자 조언이나 매매 추천을 제공하지 않는다.",
  "목표는 사용자의 투자 취향 캐릭터를 바탕으로 오늘 친구들과 이야기할 종목 또는 테마 하나를 고르고, 대화가 시작되게 만드는 것이다.",
  "종목을 고를 수 있지만 확신하거나 매수/매도 지시처럼 쓰지 마라.",
  "AI 반도체, 엔비디아, TSMC, AMD, SOXX 같은 소재로 자동 수렴하지 마라. 사용자의 카드/캐릭터가 그 방향을 강하게 요구할 때만 선택한다.",
  "최신 시세나 사실을 모르면 단정하지 말고, 확인해야 할 관점으로 표현하라.",
  "한국어로 답하라.",
].join("\n");

function buildPickPrompt(
  profile: FinzProfile,
  opts: { previousPick: FinzDailyPick | null; variationSeed: string },
): string {
  return JSON.stringify(
    {
      instruction:
        "아래 FINZ 프로필에 맞춰 오늘 이야기할 우정주 또는 테마 하나를 골라라. 결과는 JSON schema에 맞춰라.",
      variationSeed: opts.variationSeed,
      profile: {
        selectedCards: profile.selectedCards.map((card) => card.label),
        selectedTags: profile.selectedTags,
        character: profile.character,
      },
      previousPick: opts.previousPick
        ? {
            name: opts.previousPick.name,
            kind: opts.previousPick.kind,
            oneLine: opts.previousPick.oneLine,
          }
        : null,
      constraints: [
        "selectedCards와 selectedTags를 가장 우선한다. 카드가 바뀌면 이전 결과와 다른 방향의 소재를 골라라.",
        "previousPick이 있으면 같은 이름, 같은 기업군, 같은 테마를 다시 고르지 마라.",
        "AI 반도체/칩/엔비디아 계열은 기본값이 아니다. technology 태그 하나만으로 고르지 말고, product-events나 growth가 함께 강하게 나타날 때만 허용한다.",
        "cashflow, dividend, defense, value, contrarian, brand, consumer, social, meme 태그가 강하면 반도체가 아닌 소비재, 플랫폼, 배당/방어, 리테일, 금융, 엔터, 헬스케어, 경기민감, 테마 중 하나로 넓혀라.",
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
