import { NextResponse } from "next/server";
import { buildFinzProfile } from "@/lib/common/services/finz";
import { getCurrentUser } from "@/lib/server/auth";
import { getFinzProfile, upsertFinzProfile } from "@/lib/server/finz-store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const stored = await getFinzProfile(user.email);
  if (!stored) return NextResponse.json({ status: "empty" });

  const profile = buildFinzProfile(stored.selectedCardIds);
  if (!profile) return NextResponse.json({ status: "empty" });

  return NextResponse.json({
    status: "ok",
    profile,
    updatedAt: stored.updatedAt,
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  let body: { selectedCardIds?: unknown };
  try {
    body = (await req.json()) as { selectedCardIds?: unknown };
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  if (!Array.isArray(body.selectedCardIds)) {
    return NextResponse.json({ status: "error", reason: "invalid-selected-cards" }, { status: 400 });
  }

  const selectedCardIds = body.selectedCardIds.filter(
    (id): id is string => typeof id === "string",
  );
  const profile = buildFinzProfile(selectedCardIds);
  if (!profile) {
    return NextResponse.json({ status: "error", reason: "not-enough-cards" }, { status: 400 });
  }

  await upsertFinzProfile({
    userEmail: user.email,
    userName: user.name,
    profile,
  });

  return NextResponse.json({ status: "ok", profile });
}
