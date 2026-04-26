import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  listTravelFeedback,
  type TravelFeedbackCategory,
} from "@/lib/server/travel-feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_TOKEN_LENGTH = 24;

export async function GET(req: Request) {
  if (!envEnabled()) return notFound();
  if (!authorized(req)) return notFound();

  const url = new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const since = parseSince(url.searchParams.get("since"));
  const category = parseCategory(url.searchParams.get("category"));

  const records = await listTravelFeedback({
    limit,
    since: since ?? undefined,
    category: category ?? undefined,
  });
  if (records === null) {
    return NextResponse.json({ status: "not-configured" }, { status: 503 });
  }

  return NextResponse.json({
    status: "ok",
    count: records.length,
    fetchedAt: new Date().toISOString(),
    records,
  });
}

// 인증 실패와 환경 비활성 모두 404 — 라우트 존재 자체를 노출하지 않는다.
function notFound() {
  return new NextResponse(null, { status: 404 });
}

// prod 외 환경에서는 ALLOW_FEEDBACK_ADMIN=1 이 명시돼야 켜진다.
function envEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  return process.env.ALLOW_FEEDBACK_ADMIN === "1";
}

function authorized(req: Request): boolean {
  const expected = process.env.ADMIN_FEEDBACK_TOKEN;
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false;
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return false;
  const provided = match[1];
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (!raw) return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function parseSince(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function parseCategory(raw: string | null): TravelFeedbackCategory | null {
  return raw === "bug" || raw === "quality" || raw === "other" ? raw : null;
}
