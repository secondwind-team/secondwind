import { NextResponse } from "next/server";
import {
  isTravelPlan,
  normalizeTravelInput,
  validateTravelInput,
  type TravelInput,
  type TravelPlan,
} from "@/lib/common/services/travel";
import {
  createTravelFeedback,
  normalizeFeedbackDraftInput,
  normalizeFeedbackCategory,
  normalizeFeedbackMessage,
} from "@/lib/server/travel-feedback-store";

export const runtime = "nodejs";

type Body = {
  category?: unknown;
  message?: unknown;
  input?: TravelInput;
  draftInput?: unknown;
  plan?: TravelPlan;
  model?: unknown;
  pagePath?: unknown;
  context?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  const category = normalizeFeedbackCategory(body.category);
  if (!category) {
    return NextResponse.json({ status: "error", reason: "invalid-category" }, { status: 400 });
  }

  const message = normalizeFeedbackMessage(body.message);
  if (!message) {
    return NextResponse.json({ status: "error", reason: "invalid-message" }, { status: 400 });
  }

  const validation = body.input === undefined ? null : validateTravelInput(body.input);
  if (validation && !validation.ok) {
    return NextResponse.json({ status: "error", reason: validation.reason }, { status: 400 });
  }
  if (body.plan !== undefined && !isTravelPlan(body.plan)) {
    return NextResponse.json({ status: "error", reason: "invalid-plan" }, { status: 400 });
  }

  const input = validation?.ok ? validation.input : (normalizeTravelInput(body.draftInput) ?? undefined);
  const draftInput = normalizeFeedbackDraftInput(body.draftInput);
  if (!input && !draftInput) {
    return NextResponse.json({ status: "error", reason: "missing-snapshot" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model : undefined;
  const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 300) : undefined;
  const context = typeof body.context === "string" ? body.context.slice(0, 1000) : undefined;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300);

  try {
    const result = await createTravelFeedback({
      category,
      message,
      input,
      draftInput,
      plan: body.plan,
      model,
      pagePath,
      context,
      userAgent,
    });
    if (!result) {
      return NextResponse.json(
        { status: "not-configured", reason: "KV_REST_API_URL 또는 KV_REST_API_TOKEN 이 없습니다." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      id: result.id,
      expiresAt: result.record.expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        reason: err instanceof Error ? err.message : "feedback-create-failed",
      },
      { status: 500 },
    );
  }
}
