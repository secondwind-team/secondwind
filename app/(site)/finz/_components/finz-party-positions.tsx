"use client";

import { useState } from "react";
import { FINZ_PARTY_STANCES, type FinzPartyPosition, type FinzPartyStance } from "@/lib/common/services/finz";

type MemberLite = { memberId: string; displayName: string };

// 멤버별 한 줄 포지션: 내 카드는 stance 칩 + 코멘트 입력, 상대 카드는 읽기 전용.
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
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-[var(--ink)]">한 줄 포지션</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          이 우정주에 대한 내 입장을 한 줄로 남겨요. 둘 다 남기면 AI가 파티 요약을 만들어줍니다.
        </p>
      </div>

      {others.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {others.map((m) => {
            const p = positions.find((x) => x.memberId === m.memberId);
            return (
              <div key={m.memberId} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <p className="text-xs font-semibold text-emerald-700">{m.displayName}</p>
                {p ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{p.stance}</p>
                    {p.note && <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">&ldquo;{p.note}&rdquo;</p>}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">아직 포지션을 남기지 않았어요.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {myMemberId && (
        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-semibold text-emerald-700">내 포지션</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FINZ_PARTY_STANCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStance(s)}
                aria-pressed={stance === s}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  stance === s
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={80}
            placeholder="한 줄 코멘트 (선택)"
            className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-emerald-400 focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={!stance || submitting}
              onClick={() => stance && onSubmit(stance, note)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-wait ${
                stance ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
            >
              {submitting ? "저장 중" : myPos ? "포지션 수정" : "포지션 저장"}
            </button>
            {myPos && !submitting && <span className="text-xs font-medium text-emerald-700">저장됨</span>}
          </div>
          {error && (
            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
