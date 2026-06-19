"use client";

import { Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import { FinzPositionInput } from "./finz-position-input";

// 하단 입력 바(멤버 전용). + 버튼 = 액션 시트(우정주 뽑기 / 내 입장 / 요약), 본문 = 텍스트 전송.
// stance 모드는 부모가 제어(nudge 의 '입장' CTA 도 같은 모드를 연다).
export function FinzChatComposer({
  full,
  hasPick,
  canSummarize,
  sending,
  pickBusy,
  summaryBusy,
  positionSubmitting,
  myLatestStance,
  myLatestNote,
  stanceMode,
  onSetStanceMode,
  onSendText,
  onPick,
  onPosition,
  onSummary,
}: {
  full: boolean;
  hasPick: boolean;
  canSummarize: boolean;
  sending: boolean;
  pickBusy: boolean;
  summaryBusy: boolean;
  positionSubmitting: boolean;
  myLatestStance: FinzPartyStance | null;
  myLatestNote: string;
  stanceMode: boolean;
  onSetStanceMode: (v: boolean) => void;
  onSendText: (text: string) => void;
  onPick: () => void;
  onPosition: (stance: FinzPartyStance, note: string) => void;
  onSummary: () => void;
}) {
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);

  // 시트 열리면 첫 액션에 포커스, Esc 면 + 버튼으로 복귀.
  useEffect(() => {
    if (!sheetOpen) return;
    const first = sheetRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSheetOpen(false);
        plusRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function send() {
    const t = text.trim();
    if (!t || sending) return;
    onSendText(t);
    setText("");
  }

  function runAction(fn: () => void) {
    setSheetOpen(false);
    fn();
  }

  const pickReason = !full ? "친구가 들어와야 뽑을 수 있어" : hasPick ? "이미 뽑았어 (말풍선에서 다시 뽑기)" : "";
  const positionReason = !hasPick ? "우정주를 먼저 뽑아줘" : "";
  const summaryReason = !canSummarize ? "둘 다 입장을 남기면 요약할 수 있어" : "";

  return (
    <div
      className="flex-none border-t border-[var(--fz-line)] bg-[var(--fz-bg)] px-4 pt-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {stanceMode ? (
        <div className="py-2">
          <FinzPositionInput
            initialStance={myLatestStance}
            initialNote={myLatestNote}
            submitting={positionSubmitting}
            onSubmit={(s, n) => onPosition(s, n)}
            onCancel={() => onSetStanceMode(false)}
          />
        </div>
      ) : (
        <>
          {sheetOpen && (
            <div ref={sheetRef} role="menu" aria-label="파티 액션" className="mb-2 space-y-1.5 rounded-[var(--fz-r)] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-2 shadow-[var(--fz-shadow-sm)]">
              <SheetItem label="🎴 우정주 뽑기" reason={pickReason} busy={pickBusy} onClick={() => runAction(onPick)} />
              <SheetItem
                label="✋ 내 입장 남기기"
                reason={positionReason}
                onClick={() =>
                  runAction(() => onSetStanceMode(true))
                }
              />
              <SheetItem label="📝 AI 요약 받기" reason={summaryReason} busy={summaryBusy} onClick={() => runAction(onSummary)} />
            </div>
          )}

          <div className="flex items-end gap-2 pb-1">
            <button
              ref={plusRef}
              type="button"
              aria-label={sheetOpen ? "액션 닫기" : "파티 액션 열기"}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((v) => !v)}
              className="fz-btn fz-btn--ghost h-11 w-11 shrink-0 p-0"
            >
              {sheetOpen ? <X className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="메시지 보내기 · @AI 로 질문"
              className="fz-input max-h-28 min-h-11 flex-1 resize-none py-2.5"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="보내기"
              className="fz-btn h-11 w-11 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SheetItem({ label, reason, busy, onClick }: { label: string; reason: string; busy?: boolean; onClick: () => void }) {
  const disabled = Boolean(reason) || Boolean(busy);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[var(--fz-r-sm)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--fz-ink)] transition hover:bg-[var(--fz-surface-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {busy && <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--fz-coral)]" aria-hidden />}
      </span>
      {reason && <span className="text-xs font-normal text-[var(--fz-muted)]">{reason}</span>}
    </button>
  );
}
