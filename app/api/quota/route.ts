import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/server/quota-store";

export const runtime = "nodejs";
// 실시간 값이 필요하니 캐시 금지.
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
