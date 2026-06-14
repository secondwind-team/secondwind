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

// 취향 카드 → 캐릭터 소환 → 이름 → 제출. 파티 생성/합류 공용. onSubmit 으로 동작만 교체.
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
  const character = useMemo(() => (summoned ? summonFinzCharacter(selectedIds) : null), [summoned, selectedIds]);
  const canSummon = selectedIds.length >= FINZ_MIN_SELECTIONS;
  const remaining = Math.max(FINZ_MIN_SELECTIONS - selectedIds.length, 0);

  function toggle(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSummoned(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FINZ_TASTE_CARDS.map((card) => {
          const selected = selectedIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(card.id)}
              className={`flex min-h-20 items-start justify-between gap-3 rounded-[20px] border p-4 text-left transition active:scale-[0.98] ${
                selected
                  ? "border-transparent bg-[var(--fz-coral-tint)] shadow-[var(--fz-shadow-sm)]"
                  : "border-[var(--fz-line)] bg-[var(--fz-surface)] hover:border-[var(--fz-coral)]"
              }`}
            >
              <span className="text-sm font-semibold leading-relaxed text-[var(--fz-ink)]">{card.label}</span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-transparent bg-[var(--fz-coral)] text-white" : "border-[var(--fz-line)] bg-[var(--fz-surface)] text-transparent"
                }`}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[var(--fz-ink)]">
          {canSummon ? "캐릭터 소환 준비 완료 ✨" : `${remaining}개 더 고르면 소환할 수 있어요`}
        </p>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setSummoned(false);
              }}
              className="fz-btn fz-btn--ghost"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              다시 고르기
            </button>
          )}
          <button type="button" disabled={!canSummon} onClick={() => setSummoned(true)} className="fz-btn disabled:cursor-not-allowed disabled:opacity-50">
            <Sparkles className="h-4 w-4" aria-hidden />
            {character ? "다시 소환" : "캐릭터 소환"}
          </button>
        </div>
      </div>

      {character && (
        <div className="space-y-3">
          <FinzCharacterCard character={character} tags={tags} />
          <div className="flex flex-col gap-2 rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="font-semibold text-[var(--fz-ink)]">파티에서 보일 이름 (선택)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder={character.className}
                className="fz-input mt-1"
              />
            </label>
            <button type="button" disabled={pending} onClick={() => onSubmit(selectedIds, name)} className="fz-btn">
              <Sparkles className="h-4 w-4" aria-hidden />
              {pending ? "처리 중" : submitLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
