import type { FinzCharacter, FinzCharacterStats } from "@/lib/common/services/finz";

const STAT_LABELS: Array<{ key: keyof FinzCharacterStats; label: string }> = [
  { key: "attack", label: "공격력" },
  { key: "defense", label: "방어력" },
  { key: "patience", label: "인내력" },
  { key: "research", label: "정보탐색력" },
  { key: "fomoRisk", label: "FOMO 위험" },
];

export const CLASS_EMOJI: Record<string, string> = {
  "future-tech-dealer": "🚀",
  "dividend-healer": "💖",
  "value-tanker": "🛡️",
  "brand-ranger": "🛍️",
  "meme-berserker": "🔥",
  "macro-mage": "🔮",
  "crisis-scavenger": "🧲",
  "story-scout": "🧭",
};

export function finzClassEmoji(classId: string | undefined): string {
  return (classId && CLASS_EMOJI[classId]) || "✨";
}

// 한 멤버/내 투자 캐릭터를 프로필+스티커 느낌으로. taste-selector·party-room 공용.
export function FinzCharacterCard({
  character,
  name,
  tags,
  highlight,
}: {
  character: FinzCharacter;
  name?: string;
  tags?: string[];
  highlight?: boolean;
}) {
  const emoji = finzClassEmoji(character.classId);
  return (
    <article
      className={`fz-card overflow-hidden ${highlight ? "ring-2 ring-[var(--fz-coral)]" : ""}`}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="fz-avatar h-12 w-12 shrink-0 text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          {name && (
            <p className="text-xs font-semibold text-[var(--fz-coral-ink)]">
              {name}
              {highlight ? " · 나" : ""}
            </p>
          )}
          <h3 className="fz-display text-lg text-[var(--fz-ink)]">{character.className}</h3>
          <p className="text-xs font-semibold text-[var(--fz-amber-ink)]">{character.levelTitle}</p>
        </div>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4">
          {tags.map((t) => (
            <span key={t} className="fz-tag">
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="px-4 pt-3 text-sm leading-relaxed text-[var(--fz-muted)]">{character.summary}</p>

      <div className="space-y-2.5 p-4">
        {STAT_LABELS.map((stat) => (
          <div key={stat.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--fz-muted)]">{stat.label}</span>
              <span className="fz-num font-semibold text-[var(--fz-ink)]">{character.stats[stat.key]}</span>
            </div>
            <div className="fz-statbar">
              <i style={{ width: `${character.stats[stat.key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-3">
          <p className="text-xs font-semibold text-[var(--fz-ink)]">약점</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">{character.weakness}</p>
        </div>
        <div className="rounded-[14px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-3">
          <p className="text-xs font-semibold text-[var(--fz-ink)]">친구에게 공유할 한 줄</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">{character.tease}</p>
        </div>
      </div>
    </article>
  );
}
