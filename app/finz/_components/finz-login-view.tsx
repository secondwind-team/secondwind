"use client";

import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 미로그인 게이트. 로그인은 "인증"만 — 로그인 후 FINZ 핸들/캐릭터를 만드는 온보딩으로 이어진다.
// Google 또는 이메일/비밀번호. finz 계정은 provider-agnostic 이라 어느 쪽이든 같은 온보딩·계정 모델로 귀속된다.
export function FinzLoginView({ unconfigured }: { unconfigured?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("이메일과 비밀번호를 입력해줘.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 8) {
        setError("비밀번호는 8자 이상이어야 해.");
        return;
      }
      if (password !== confirm) {
        setError("비밀번호가 서로 달라. 다시 확인해줘.");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/finz/auth/password/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: em, password }),
        });
        const json = (await res.json().catch(() => ({}))) as { status?: string; reason?: string };
        if (res.status === 409) {
          setError("이미 가입된 이메일이에요. 로그인으로 시도해줘.");
          setBusy(false);
          return;
        }
        if (!res.ok || json.status !== "ok") {
          setError(
            json.reason === "invalid-email"
              ? "이메일 형식을 확인해줘."
              : json.reason === "invalid-password"
                ? "비밀번호는 8자 이상이어야 해."
                : "가입에 실패했어. 잠시 뒤 다시 시도해줘.",
          );
          setBusy(false);
          return;
        }
      }
      const result = await signIn("password", { redirect: false, email: em, password });
      if (!result || result.error) {
        setError(
          mode === "signup"
            ? "가입은 됐지만 로그인에 실패했어. 로그인 탭에서 다시 시도해줘."
            : "이메일 또는 비밀번호가 올바르지 않아요.",
        );
        setBusy(false);
        return;
      }
      // 세션 쿠키가 세팅됐다 → SSR 계정 게이트를 다시 평가(온보딩 또는 4탭으로). busy 는 유지(전환 중).
      router.refresh();
    } catch {
      setError("연결이 잠깐 끊겼어. 다시 시도해줘.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="fz-avatar mb-5 h-16 w-16 text-2xl" aria-hidden>
        🪙
      </div>
      <p className="fz-seclabel">finz · 핀즈</p>
      <h1 className="fz-display mt-2 text-3xl leading-tight text-[var(--fz-ink)]">
        친구랑 편하게
        <br />
        투자 수다 떠는 곳
      </h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--fz-muted)]">
        캐릭터로 만나 우정주를 뽑고, 대화방에서 AI와 함께 가볍게 이야기해요. 투자 조언이 아니라 대화 소재예요.
      </p>

      {unconfigured ? (
        <p className="fz-alert mt-6 max-w-xs">지금은 계정 서버 설정이 안 되어 있어요. 잠시 뒤 다시 시도해주세요.</p>
      ) : (
        <div className="mt-8 w-full max-w-xs">
          <button type="button" onClick={() => void signIn("google")} className="fz-btn fz-btn--ghost w-full">
            <LogIn className="h-4 w-4" aria-hidden />
            Google 로 계속하기
          </button>

          <div className="my-4 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-[var(--fz-line)]" />
            <span className="text-xs text-[var(--fz-muted)]">또는 이메일로</span>
            <span className="h-px flex-1 bg-[var(--fz-line)]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-2 text-left">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="fz-input"
              aria-label="이메일"
            />
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="비밀번호 (8자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="fz-input"
              aria-label="비밀번호"
            />
            {mode === "signup" && (
              <input
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 확인"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="fz-input"
                aria-label="비밀번호 확인"
              />
            )}
            {error && <p className="fz-alert">{error}</p>}
            <button type="submit" disabled={busy} className="fz-btn w-full">
              {busy ? "잠시만…" : mode === "signup" ? "이메일로 가입하기" : "이메일로 로그인"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setError(null);
              setConfirm("");
            }}
            className="mt-3 text-xs font-semibold text-[var(--fz-coral-ink)] underline underline-offset-2"
          >
            {mode === "login" ? "계정이 없어요 · 이메일로 가입하기" : "이미 계정이 있어요 · 로그인"}
          </button>
        </div>
      )}
      <p className="mt-4 max-w-xs text-xs leading-relaxed text-[var(--fz-muted)]">
        로그인은 본인 확인용이에요. 핸들·캐릭터 같은 프로필은 핀즈가 따로 관리해요.
      </p>
    </div>
  );
}
