"use client";

import { useState } from "react";
import { FINZ_PARTY_STANCES, type FinzPartyPosition, type FinzPartyStance } from "@/lib/common/services/finz";

type MemberLite = { memberId: string; displayName: string };

const STANCE_EMOJI: Record<FinzPartyStance, string> = {
  "매력 있음": "😍",
  관망: "🤔",
  회의적: "🙅",
  "모르지만 끌림": "👀",
  "너무 비싸지만 계속 보게 됨": "💸",
  "친구 말 듣고 다시 봄": "👂",
};

// 한 줄 포지션: 상대는 왼쪽 채팅 말풍선(읽기 전용), 내 건 stance 칩 + 코멘트 입력.
export function FinzPartyPositions({
  members,
  positions,
  myMemberId,
  submitting,
  error,
  onSubmit,
}: {
  members: MemberLite[];
  positions: FinzPartyPosition[];
  myMemberId: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (stance: FinzPartyStance, note: string) => void;
}) {
  const myPos = positions.find((p) => p.memberId === myMemberId);
  const [stance, setStance] = useState<FinzPartyStance | null>(myPos?.stance ?? null);
  const [note, setNote] = useState(myPos?.note ?? "");

  const others = members.filter((m) => m.memberId !== myMemberId);

  return (
    <section className="fz-card space-y-4 p-5">
      <div>
        <h3 className="fz-display text-lg text-[var(--fz-ink)]">한 줄 포지션</h3>
        <p className="mt-1 text-sm text-[var(--fz-muted)]">내 입장을 한 줄로 남겨봐. 둘 다 남기면 AI가 파티 요약을 만들어줘.</p>
      </div>

      {/* 상대 포지션 — 왼쪽 채팅 말풍선 */}
      {others.map((m) => {
        const p = positions.find((x) => x.memberId === m.memberId);
        return (
          <div key={m.memberId} className="flex flex-col gap-1">
            <span className="px-1 text-xs text-[var(--fz-muted)]">{m.displayName}</span>
            {p ? (
              <div className="fz-msg">
                <span className="font-semibold">
                  {STANCE_EMOJI[p.stance]} {p.stance}
                </span>
                {p.note && <span className="text-[var(--fz-muted)]"> · {p.note}</span>}
              </div>
            ) : (
              <div className="fz-msg text-[var(--fz-muted)]">아직 포지션을 남기지 않았어요.</div>
            )}
          </div>
        );
      })}

      {/* 내 포지션 입력 */}
      {myMemberId && (
        <div className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4">
          <p className="text-xs font-semibold text-[var(--fz-coral-ink)]">내 포지션</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FINZ_PARTY_STANCES.map((s) => (
              <button key={s} type="button" aria-pressed={stance === s} onClick={() => setStance(s)} className="fz-chip">
                {STANCE_EMOJI[s]} {s}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={80}
            placeholder="한 줄 코멘트 (선택)"
            className="fz-input mt-3"
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={!stance || submitting} onClick={() => stance && onSubmit(stance, note)} className="fz-btn disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "저장 중" : myPos ? "포지션 수정" : "포지션 저장"}
            </button>
            {myPos && !submitting && <span className="text-xs font-medium text-[var(--fz-coral-ink)]">저장됨</span>}
          </div>
          {error && <p className="fz-alert mt-2">{error}</p>}
        </div>
      )}
    </section>
  );
}
