"use client";

import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

// 미로그인 게이트. Google 은 "인증"만 — 로그인 후 FINZ 핸들/캐릭터를 만드는 온보딩으로 이어진다.
export function FinzLoginView({ unconfigured }: { unconfigured?: boolean }) {
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
        <p className="fz-alert mt-6 max-w-xs">
          지금은 계정 서버 설정이 안 되어 있어요. 잠시 뒤 다시 시도해주세요.
        </p>
      ) : (
        <button type="button" onClick={() => void signIn("google")} className="fz-btn mt-8 w-full max-w-xs">
          <LogIn className="h-4 w-4" aria-hidden />
          Google 로그인으로 시작하기
        </button>
      )}
      <p className="mt-4 max-w-xs text-xs leading-relaxed text-[var(--fz-muted)]">
        로그인은 본인 확인용이에요. 핸들·캐릭터 같은 프로필은 핀즈가 따로 관리해요.
      </p>
    </div>
  );
}
