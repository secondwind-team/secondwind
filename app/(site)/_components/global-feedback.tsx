"use client";

import { useEffect, useState } from "react";
import { Bug, MessageSquare, Send, X } from "lucide-react";

type FeedbackCategory = "bug" | "quality" | "other";
type FeedbackState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; id: string }
  | { kind: "error"; message: string };

const OPTIONS: Array<{ id: FeedbackCategory; label: string }> = [
  { id: "quality", label: "품질" },
  { id: "bug", label: "버그" },
  { id: "other", label: "기타" },
];

export function GlobalFeedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("quality");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FeedbackState>({ kind: "idle" });
  const canSubmit = message.trim().length >= 3 && state.kind !== "saving";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function submit() {
    if (!canSubmit) return;
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/travel/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          pagePath: window.location.pathname,
          context: "global-feedback",
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.status !== "ok" || typeof json.id !== "string") {
        setState({ kind: "error", message: friendlyFeedbackError(json) });
        return;
      }
      setMessage("");
      setState({ kind: "ok", id: json.id });
    } catch {
      setState({ kind: "error", message: "피드백을 보내지 못했습니다. 잠시 후 다시 시도해주세요." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (state.kind !== "saving") setState({ kind: "idle" });
        }}
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        aria-label="피드백 또는 버그리포트 열기"
        title="피드백 · 버그리포트"
      >
        <MessageSquare className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Bug className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                피드백 · 버그리포트
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                현재 페이지 주소와 함께 기록합니다. 전화번호와 이메일은 자동으로 가립니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-xs font-medium transition ${
                  category === option.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]"
                }`}
              >
                <input
                  type="radio"
                  name="global-feedback-category"
                  value={option.id}
                  checked={category === option.id}
                  onChange={() => setCategory(option.id)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value.slice(0, 1000));
              if (state.kind !== "saving") setState({ kind: "idle" });
            }}
            rows={4}
            maxLength={1000}
            placeholder="무엇이 이상했는지 적어주세요."
            className="mt-3 w-full resize-y rounded-xl border border-[var(--line)] px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--muted)]">{message.length} / 1000</p>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {state.kind === "saving" ? "보내는 중" : "보내기"}
            </button>
          </div>

          {state.kind === "ok" && (
            <p role="status" className="mt-2 text-xs text-emerald-700">
              피드백을 받았습니다. 기록 ID: {state.id}
            </p>
          )}
          {state.kind === "error" && (
            <p role="status" className="mt-2 text-xs text-amber-800">
              {state.message}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function friendlyFeedbackError(json: Record<string, unknown>): string {
  if (json.status === "not-configured") return "피드백 저장소가 아직 연결되지 않았습니다.";
  if (json.reason === "invalid-message") return "피드백을 세 글자 이상 적어주세요.";
  return "피드백을 보내지 못했습니다. 잠시 후 다시 시도해주세요.";
}
