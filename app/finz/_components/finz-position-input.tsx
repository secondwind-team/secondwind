"use client";

import { useState } from "react";
import { FINZ_PARTY_STANCES, type FinzPartyStance } from "@/lib/common/services/finz";

export const STANCE_EMOJI: Record<FinzPartyStance, string> = {
  "매력 있음": "😍",
  관망: "🤔",
  회의적: "🙅",
  "모르지만 끌림": "👀",
  "너무 비싸지만 계속 보게 됨": "💸",
  "친구 말 듣고 다시 봄": "👂",
};

// 한 줄 포지션 입력 — stance 칩 + 코멘트. 컴포저의 stance 모드에서 쓴다. 기존 입장으로 pre-fill.
export function FinzPositionInput({
  initialStance,
  initialNote,
  submitting,
  onSubmit,
  onCancel,
}: {
  initialStance?: FinzPartyStance | null;
  initialNote?: string;
  submitting: boolean;
  onSubmit: (stance: FinzPartyStance, note: string) => void;
  onCancel: () => void;
}) {
  const [stance, setStance] = useState<FinzPartyStance | null>(initialStance ?? null);
  const [note, setNote] = useState(initialNote ?? "");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--fz-coral-ink)]">내 한 줄 입장</p>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-[var(--fz-muted)] hover:text-[var(--fz-coral-ink)]">
          닫기
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {FINZ_PARTY_STANCES.map((s) => (
          <button key={s} type="button" aria-pressed={stance === s} onClick={() => setStance(s)} className="fz-chip">
            {STANCE_EMOJI[s]} {s}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={80}
          placeholder="한 줄 코멘트 (선택)"
          className="fz-input flex-1"
        />
        <button
          type="button"
          disabled={!stance || submitting}
          onClick={() => stance && onSubmit(stance, note)}
          className="fz-btn shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "보내는 중" : "보내기"}
        </button>
      </div>
    </div>
  );
}
