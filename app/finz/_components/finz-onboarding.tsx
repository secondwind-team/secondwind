"use client";

import { AtSign, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FINZ_HANDLE_MAX, isValidHandle, normalizeHandle, type FinzAccount } from "@/lib/common/services/finz-account";
import { FinzCharacterBuilder } from "./finz-character-builder";

// 로그인 후 첫 1회: 핸들(친구가 찾을 주소) + 캐릭터(취향 카드)로 FINZ 계정을 만든다.
export function FinzOnboarding({ onDone }: { onDone: (account: FinzAccount) => void }) {
  const [handleInput, setHandleInput] = useState("");
  const [avail, setAvail] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = normalizeHandle(handleInput);

  // 핸들 가용성 디바운스 체크.
  useEffect(() => {
    if (handle.length === 0) {
      setAvail("idle");
      return;
    }
    if (!isValidHandle(handle)) {
      setAvail("invalid");
      return;
    }
    setAvail("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/finz/account/handle?handle=${encodeURIComponent(handle)}`, { cache: "no-store" });
        const json = (await res.json()) as { valid?: boolean; available?: boolean };
        if (cancelled) return;
        if (!json.valid) setAvail("invalid");
        else setAvail(json.available ? "available" : "taken");
      } catch {
        if (!cancelled) setAvail("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle]);

  async function submit(selectedCardIds: string[], displayName: string) {
    if (avail !== "available") {
      setError("사용할 수 있는 핸들을 먼저 정해줘.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/finz/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, displayName, selectedCardIds }),
      });
      const json = (await res.json()) as { status: string; account?: FinzAccount };
      if (res.status === 409 || json.status === "handle-taken") {
        setAvail("taken");
        setError("방금 누가 같은 핸들을 가져갔어. 다른 걸로 해줘.");
        return;
      }
      if (!res.ok || json.status !== "ok" || !json.account) {
        throw new Error("onboarding-failed");
      }
      onDone(json.account);
    } catch {
      setError("계정을 만들지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6">
      <header className="fz-bubble fz-bubble--pick p-5 sm:p-6">
        <p className="fz-seclabel">finz · 시작하기</p>
        <h1 className="fz-display mt-2 text-2xl leading-tight text-[var(--fz-ink)]">
          핸들과 캐릭터를 정해
          <br />
          핀즈를 시작해요.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          핸들은 친구가 너를 찾는 주소예요(예: @jiheon). 취향 카드로 투자 캐릭터도 만들어요.
        </p>
      </header>

      <section className="fz-card mt-4 space-y-3 p-5">
        <label className="block text-sm font-semibold text-[var(--fz-ink)]">내 핸들</label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fz-muted)]" aria-hidden />
          <input
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            maxLength={FINZ_HANDLE_MAX + 2}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="jiheon"
            className="fz-input fz-input--icon"
            aria-label="핸들"
          />
        </div>
        <p className="text-xs leading-relaxed text-[var(--fz-muted)]">
          {avail === "checking" && "확인 중…"}
          {avail === "available" && (
            <span className="inline-flex items-center gap-1 text-[var(--fz-amber-ink)]">
              <Check className="h-3.5 w-3.5" aria-hidden /> @{handle} 쓸 수 있어요
            </span>
          )}
          {avail === "taken" && (
            <span className="inline-flex items-center gap-1 text-[var(--fz-coral-ink)]">
              <X className="h-3.5 w-3.5" aria-hidden /> 이미 쓰는 핸들이에요
            </span>
          )}
          {avail === "invalid" && "소문자·숫자·밑줄 3~20자로 정해줘"}
          {(avail === "idle") && "소문자·숫자·밑줄 3~20자"}
        </p>
      </section>

      <section className="fz-card mt-4 space-y-4 p-5">
        <div>
          <p className="fz-seclabel">taste cards</p>
          <h2 className="fz-display mt-2 text-xl text-[var(--fz-ink)]">끌리는 문장을 3개 이상 골라줘</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">
            고른 취향이 Lv.1 투자 캐릭터로 바뀌어요. 프로필에서 언제든 다시 바꿀 수 있어.
          </p>
        </div>
        <FinzCharacterBuilder
          submitLabel="핀즈 시작하기"
          pending={submitting}
          onSubmit={submit}
          nameLabel="표시 이름 (선택)"
        />
        {error && <p className="fz-alert">{error}</p>}
      </section>
    </div>
  );
}
