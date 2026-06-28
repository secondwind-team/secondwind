"use client";

import { Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import { splitByMentionTokens } from "@/lib/common/services/finz-chat";
import { FinzPositionInput } from "./finz-position-input";

// 하단 입력 바(멤버 전용). + 버튼 = 액션 시트(우정주 뽑기 / 내 입장 / 요약), 본문 = 텍스트 전송.
// stance 모드는 부모가 제어(nudge 의 '입장' CTA 도 같은 모드를 연다).
export function FinzChatComposer({
  full,
  hasPick,
  sending,
  pickBusy,
  recapBusy,
  positionSubmitting,
  myLatestStance,
  myLatestNote,
  stanceMode,
  mentionNames,
  onSetStanceMode,
  onSendText,
  onPick,
  onPosition,
  onRecap,
}: {
  full: boolean;
  hasPick: boolean;
  sending: boolean;
  pickBusy: boolean;
  recapBusy: boolean;
  positionSubmitting: boolean;
  myLatestStance: FinzPartyStance | null;
  myLatestNote: string;
  stanceMode: boolean;
  mentionNames: string[]; // 멤버 이름들(@남덕우 처럼 입력 중 배지 강조용)
  onSetStanceMode: (v: boolean) => void;
  onSendText: (text: string) => void;
  onPick: () => void;
  onPosition: (stance: FinzPartyStance, note: string) => void;
  onRecap: () => void;
}) {
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // textarea 가 내부 스크롤되면 백드롭(하이라이트)도 같은 위치로 맞춘다(긴 글 줄바꿈 정렬).
  function syncScroll() {
    const ta = taRef.current;
    const bd = backdropRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  }

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
              <SheetItem label="📝 대화 요약" reason="" busy={recapBusy} onClick={() => runAction(onRecap)} />
            </div>
          )}

          <div className="flex items-end gap-2 pb-1">
            <button
              ref={plusRef}
              type="button"
              aria-label={sheetOpen ? "액션 닫기" : "파티 액션 열기"}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((v) => !v)}
              className="fz-btn fz-btn--ghost h-11 w-11 shrink-0"
              style={{ padding: 0 }}
            >
              {sheetOpen ? <X className="h-6 w-6 shrink-0" aria-hidden /> : <Plus className="h-6 w-6 shrink-0" aria-hidden />}
            </button>

            {/* 멘션 하이라이트 오버레이: 타이핑 중에도 @finz 가 배지처럼 보이게.
                백드롭(아래)이 스타일된 텍스트를 그리고, 위 textarea 는 글자/배경 투명 + 캐럿만 보이게 겹친다.
                글자 폭을 바꾸지 않는 .fz-mention-live 라 캐럿이 정확히 정렬된다(한글 IME 안전 — 진짜 textarea 유지). */}
            <div className="relative flex-1">
              <div
                ref={backdropRef}
                aria-hidden
                className="fz-input pointer-events-none absolute inset-0 max-h-28 overflow-hidden whitespace-pre-wrap break-words py-2.5 text-[var(--fz-ink)]"
                style={{ borderColor: "transparent" }}
              >
                {splitByMentionTokens(text, mentionNames).map((seg, i) =>
                  seg.isMention ? (
                    <span key={i} className="fz-mention-live">
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
                {/* 줄바꿈으로 끝나면 마지막 빈 줄 높이를 유지(스크롤 정렬). */}
                {text.endsWith("\n") ? " " : ""}
              </div>
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={syncScroll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="메시지 보내기 · @finz 로 질문"
                className="fz-input relative max-h-28 min-h-11 w-full resize-none py-2.5"
                style={{ background: "transparent", color: "transparent", caretColor: "var(--fz-ink)" }}
              />
            </div>

            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="보내기"
              className="fz-btn h-11 w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: 0 }}
            >
              <Send className="h-6 w-6 shrink-0" aria-hidden />
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
