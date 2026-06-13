import type { FinzCharacter, FinzCharacterStats } from "@/lib/common/services/finz";

const STAT_LABELS: Array<{ key: keyof FinzCharacterStats; label: string }> = [
  { key: "attack", label: "공격력" },
  { key: "defense", label: "방어력" },
  { key: "patience", label: "인내력" },
  { key: "research", label: "정보탐색력" },
  { key: "fomoRisk", label: "FOMO 위험" },
];

// 한 멤버의 투자 캐릭터를 보여주는 프레젠테이션 컴포넌트. 파티 룸과 빌더 결과에서 재사용.
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
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white ${
        highlight ? "border-emerald-400 ring-2 ring-emerald-200" : "border-emerald-200"
      }`}
    >
      <div className="border-b border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        {name && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {name}
            {highlight ? " · 나" : ""}
          </p>
        )}
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">{character.className}</h3>
        <p className="mt-0.5 text-sm font-semibold text-emerald-800">{character.levelTitle}</p>
        {tags && tags.length > 0 && (
          <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            {tags.join(" / ")}
          </span>
        )}
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{character.summary}</p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <section>
          <h4 className="text-sm font-semibold text-[var(--ink)]">스탯</h4>
          <div className="mt-3 space-y-2.5">
            {STAT_LABELS.map((stat) => (
              <div key={stat.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--muted)]">{stat.label}</span>
                  <span className="font-semibold text-[var(--ink)]">{character.stats[stat.key]}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${character.stats[stat.key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl border border-emerald-100 bg-white p-3">
            <h4 className="text-sm font-semibold text-[var(--ink)]">약점</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{character.weakness}</p>
          </section>
          <section className="rounded-xl border border-emerald-100 bg-white p-3">
            <h4 className="text-sm font-semibold text-[var(--ink)]">친구에게 공유할 한 줄</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{character.tease}</p>
          </section>
        </div>
      </div>
    </article>
  );
}
