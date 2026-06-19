import { NextResponse } from "next/server";
import { isValidHandle, normalizeHandle } from "@/lib/common/services/finz-account";
import { resolveAuth } from "@/lib/server/finz-account";
import { getAccountByHandle, isFinzAccountStoreConfigured } from "@/lib/server/finz-account-store";

export const runtime = "nodejs";

// 온보딩 중 핸들 가용성 체크. 인증 필요(가입 직전 사용자).
export async function GET(req: Request) {
  if (!isFinzAccountStoreConfigured()) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ status: "anon" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("handle") ?? "";
  const handle = normalizeHandle(raw);
  if (!isValidHandle(handle)) {
    return NextResponse.json({ status: "ok", handle, valid: false, available: false });
  }
  try {
    const taken = await getAccountByHandle(handle);
    return NextResponse.json({ status: "ok", handle, valid: true, available: !taken });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
