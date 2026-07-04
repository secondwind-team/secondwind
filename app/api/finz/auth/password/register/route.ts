import { NextResponse } from "next/server";
import {
  isFinzAccountStoreConfigured,
  registerPasswordCredential,
} from "@/lib/server/finz-account-store";
import { isValidEmail, isValidPassword, normalizeEmail } from "@/lib/server/finz-password";

export const runtime = "nodejs";

// 이메일/비밀번호 회원가입 — 자격증명(email→scrypt 해시)만 만든다. 계정/핸들은 이어지는 온보딩에서 생성.
// (로그인 검증은 NextAuth credentials authorize 가 담당. 가입 성공 후 클라이언트가 signIn 을 호출한다.)
type Body = { email?: unknown; password?: unknown };

export async function POST(req: Request) {
  if (!isFinzAccountStoreConfigured()) {
    return NextResponse.json({ status: "error", reason: "unconfigured" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ status: "error", reason: "invalid-email" }, { status: 400 });
  }
  if (!isValidPassword(body.password)) {
    return NextResponse.json({ status: "error", reason: "invalid-password" }, { status: 400 });
  }

  const result = await registerPasswordCredential(email, body.password);
  if (result === "exists") {
    return NextResponse.json({ status: "error", reason: "email-taken" }, { status: 409 });
  }
  return NextResponse.json({ status: "ok" });
}
