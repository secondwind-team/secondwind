"use client";

import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  FINZ_MIN_SELECTIONS,
  FINZ_TASTE_CARDS,
  getSelectedTasteCards,
  summarizeTasteTags,
  summonFinzCharacter,
} from "@/lib/common/services/finz";
import { FinzCharacterCard } from "./finz-character-card";

// 취향 카드 선택 → 캐릭터 소환 → 이름 입력 → 제출. 파티 생성/합류 양쪽에서 재사용.
// onSubmit 으로 동작만 갈아끼운다(생성 vs 합류). 로그인·네트워크 없이 소환까지 동작.
export function FinzCharacterBuilder({
  submitLabel,
  pending,
  onSubmit,
}: {
  submitLabel: string;
  pending?: boolean;
  onSubmit: (selectedCardIds: string[], displayName: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [summoned, setSummoned] = useState(false);

  const selectedCards = useMemo(() => getSelectedTasteCards(selectedIds), [selectedIds]);
  const tags = useMemo(() => summarizeTasteTags(selectedCards), [selectedCards]);
  const character = useMemo(
    () => (summoned ? summonFinzCharacter(selectedIds) : null),
    [summoned, selectedIds],
  );
  const canSummon = selectedIds.length >= FINZ_MIN_SELECTIONS;
  const remaining = Math.max(FINZ_MIN_SELECTIONS - selectedIds.length, 0);

  function toggle(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSummoned(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FINZ_TASTE_CARDS.map((card) => {
          const selected = selectedIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(card.id)}
              className={`flex min-h-24 flex-col justify-between rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
                selected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-[var(--line)] bg-slate-50 hover:border-emerald-300 hover:bg-white hover:shadow-sm"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold leading-relaxed text-[var(--ink)]">{card.label}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {canSummon ? "캐릭터 소환 준비 완료" : `${remaining}개 더 고르면 캐릭터를 소환할 수 있어요`}
        </p>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setSummoned(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              다시 고르기
            </button>
          )}
          <button
            type="button"
            disabled={!canSummon}
            onClick={() => setSummoned(true)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              canSummon ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {character ? "다시 소환" : "캐릭터 소환"}
          </button>
        </div>
      </div>

      {character && (
        <div className="space-y-4">
          <FinzCharacterCard character={character} tags={tags} />
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="font-semibold text-[var(--ink)]">파티에서 보일 이름 (선택)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder={character.className}
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-emerald-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() => onSubmit(selectedIds, name)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-300"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {pending ? "처리 중" : submitLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
