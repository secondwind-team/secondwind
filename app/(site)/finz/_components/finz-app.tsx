"use client";

import { useMemo, useState } from "react";
import { Flame, Gem, LineChart, Radar, Shield, Sparkles, UserPlus, Users } from "lucide-react";

type TasteCard = {
  id: string;
  title: string;
  text: string;
  tags: string[];
  stats: StatScores;
};

type StatScores = {
  attack: number;
  defense: number;
  patience: number;
  research: number;
  fomo: number;
};

type Character = {
  role: string;
  title: string;
  summary: string;
  weakness: string;
  tease: string;
  accent: string;
  icon: "spark" | "shield" | "flame" | "radar" | "gem";
};

type CharacterResult = {
  character: Character;
  stats: StatScores;
  tags: string[];
};

type FriendMember = CharacterResult & {
  id: string;
  name: string;
};

const EMPTY_STATS: StatScores = {
  attack: 0,
  defense: 0,
  patience: 0,
  research: 0,
  fomo: 0,
};

const TASTE_CARDS: TasteCard[] = [
  {
    id: "future-tech",
    title: "세상을 바꾸는 기술",
    text: "AI, 로봇, 반도체처럼 판을 바꾸는 이야기에 먼저 반응합니다.",
    tags: ["AI", "성장", "미래"],
    stats: { attack: 5, defense: 1, patience: 2, research: 4, fomo: 4 },
  },
  {
    id: "cashflow",
    title: "마음 편한 현금흐름",
    text: "꾸준히 돈을 버는 회사와 배당, 방어력을 좋아합니다.",
    tags: ["배당", "안정", "현금"],
    stats: { attack: 1, defense: 5, patience: 5, research: 2, fomo: 0 },
  },
  {
    id: "brand",
    title: "내가 쓰는 브랜드",
    text: "일상에서 자주 보이는 브랜드와 소비자 반응을 믿습니다.",
    tags: ["브랜드", "소비", "관찰"],
    stats: { attack: 3, defense: 2, patience: 3, research: 4, fomo: 2 },
  },
  {
    id: "undervalued",
    title: "남들이 놓친 저평가",
    text: "조용하지만 싸 보이는 회사를 찾을 때 가장 신납니다.",
    tags: ["가치", "발견", "인내"],
    stats: { attack: 2, defense: 4, patience: 5, research: 5, fomo: 0 },
  },
  {
    id: "hype",
    title: "사람들이 떠드는 곳",
    text: "밈, 커뮤니티, 관심 폭발 구간에서 에너지를 읽습니다.",
    tags: ["밈", "속도", "화제"],
    stats: { attack: 5, defense: 0, patience: 1, research: 2, fomo: 5 },
  },
  {
    id: "crisis",
    title: "위기 때 줍기",
    text: "공포가 커질 때 오히려 좋은 기회를 찾고 싶어집니다.",
    tags: ["역발상", "위기", "용기"],
    stats: { attack: 4, defense: 3, patience: 4, research: 3, fomo: 1 },
  },
  {
    id: "macro",
    title: "큰 흐름 먼저",
    text: "금리, 환율, 정책 같은 거대한 바람이 어디로 부는지 봅니다.",
    tags: ["매크로", "정책", "사이클"],
    stats: { attack: 2, defense: 3, patience: 4, research: 5, fomo: 1 },
  },
  {
    id: "story",
    title: "숫자보다 스토리",
    text: "차트보다 서사와 제품, 창업자 이야기에 마음이 먼저 갑니다.",
    tags: ["스토리", "제품", "비전"],
    stats: { attack: 4, defense: 1, patience: 2, research: 3, fomo: 3 },
  },
];

const CHARACTERS: Character[] = [
  {
    role: "미래기술 딜러",
    title: "Lv.1 다음 분기보다 다음 시대",
    summary: "아직 돈을 버는 회사보다 세상을 바꿀 것 같은 회사를 먼저 봅니다.",
    weakness: "기대감이 커지면 가격표를 늦게 봅니다.",
    tease: "엔비디아 얘기 나오면 갑자기 말이 빨라지는 타입",
    accent: "bg-blue-600",
    icon: "spark",
  },
  {
    role: "배당 힐러",
    title: "Lv.1 계좌의 체온 유지 담당",
    summary: "천천히 가도 현금흐름과 안정감이 있는 선택을 선호합니다.",
    weakness: "너무 편한 종목에 오래 머물 수 있습니다.",
    tease: "모두가 달릴 때 혼자 배당락일을 확인하는 타입",
    accent: "bg-emerald-600",
    icon: "shield",
  },
  {
    role: "브랜드 레인저",
    title: "Lv.1 거리의 소비 신호 수집가",
    summary: "사람들이 실제로 쓰고 좋아하는 브랜드에서 투자 힌트를 찾습니다.",
    weakness: "좋아하는 제품과 좋은 가격을 가끔 헷갈립니다.",
    tease: "카페 줄 보고 갑자기 투자 thesis 쓰는 타입",
    accent: "bg-rose-600",
    icon: "radar",
  },
  {
    role: "가치 탱커",
    title: "Lv.1 싼 것에는 이유가 있나 검사관",
    summary: "남들이 지나친 숫자와 가격 차이를 차분히 뜯어봅니다.",
    weakness: "기다림이 길어지면 파티 채팅이 조용해집니다.",
    tease: "친구가 뜨겁다 할 때 PER부터 묻는 타입",
    accent: "bg-slate-700",
    icon: "gem",
  },
  {
    role: "밈 버서커",
    title: "Lv.1 화제성 과열 감지반",
    summary: "시장의 농담, 열기, 커뮤니티 에너지에서 움직임을 포착합니다.",
    weakness: "빠른 만큼 출구도 빨라야 하는데 가끔 늦습니다.",
    tease: "이거 밈 아니야? 라고 하면서 이미 찾아본 타입",
    accent: "bg-orange-600",
    icon: "flame",
  },
  {
    role: "매크로 마법사",
    title: "Lv.1 금리 바람 읽는 사람",
    summary: "개별 회사보다 금리, 환율, 정책과 사이클을 먼저 해석합니다.",
    weakness: "큰 그림이 너무 커서 오늘 살 종목이 늦게 나옵니다.",
    tease: "친구가 종목 물어봤는데 환율부터 설명하는 타입",
    accent: "bg-violet-600",
    icon: "spark",
  },
];

const SAMPLE_FRIENDS: FriendMember[] = [
  {
    id: "taehoon",
    name: "태훈",
    character: CHARACTERS[1]!,
    stats: { attack: 3, defense: 9, patience: 9, research: 5, fomo: 1 },
    tags: ["배당", "안정", "현금", "인내"],
  },
  {
    id: "jiheon",
    name: "지헌",
    character: CHARACTERS[3]!,
    stats: { attack: 4, defense: 8, patience: 8, research: 9, fomo: 2 },
    tags: ["가치", "발견", "분석", "인내"],
  },
  {
    id: "deokwoo",
    name: "덕우",
    character: CHARACTERS[0]!,
    stats: { attack: 9, defense: 3, patience: 4, research: 7, fomo: 7 },
    tags: ["AI", "성장", "미래", "속도"],
  },
];

export function FinzApp() {
  const [selected, setSelected] = useState<string[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const selectedCards = useMemo(
    () => TASTE_CARDS.filter((card) => selected.includes(card.id)),
    [selected],
  );
  const result = selectedCards.length >= 3 ? buildCharacter(selectedCards) : undefined;
  const activeFriends = useMemo(
    () => SAMPLE_FRIENDS.filter((friend) => friendIds.includes(friend.id)),
    [friendIds],
  );

  function toggleCard(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  }

  function toggleFriend(id: string) {
    setFriendIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">FINZ</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl sm:leading-tight">
              투자 취향으로 내 캐릭터를 소환하기
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              종목명부터 고르지 않아도 괜찮아요. 끌리는 투자 취향을 고르면 FINZ가 친구들과 공유할 캐릭터로 바꿔줍니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">카드 {selected.length}/5</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                {selected.length >= 3 ? "소환 준비 완료" : "3개부터 소환"}
              </span>
            </div>
          </div>
          <div className="border-t border-[var(--line)] bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
            {result ? <CharacterPanel result={result} /> : <EmptyPanel selectedCount={selected.length} />}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">taste cards</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">끌리는 카드 선택</h2>
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-blue-300 hover:text-blue-700"
            >
              초기화
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TASTE_CARDS.map((card) => {
            const checked = selected.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleCard(card.id)}
                className={`min-h-44 rounded-2xl border bg-white p-4 text-left transition ${
                  checked
                    ? "border-blue-500 shadow-[0_12px_28px_rgb(37_99_235/0.16)]"
                    : "border-[var(--line)] hover:-translate-y-0.5 hover:border-blue-300"
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                    checked ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <LineChart className="h-4 w-4" aria-hidden />
                </span>
                <span className="mt-3 block text-sm font-semibold text-[var(--ink)]">{card.title}</span>
                <span className="mt-2 block text-xs leading-relaxed text-[var(--muted)]">{card.text}</span>
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <PartySection result={result} friends={activeFriends} selectedFriendIds={friendIds} onToggleFriend={toggleFriend} />
    </div>
  );
}

function EmptyPanel({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex h-full min-h-72 flex-col justify-between">
      <div>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <Users className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-5 text-sm font-semibold text-white">파티 슬롯 대기 중</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {selectedCount === 0
            ? "첫 취향을 고르면 캐릭터 스탯이 움직이기 시작합니다."
            : `${3 - selectedCount}개만 더 고르면 캐릭터가 등장합니다.`}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2 pt-8">
        {["공격", "방어", "인내", "탐색", "FOMO"].map((label) => (
          <div key={label} className="rounded-xl bg-white/5 p-2 text-center">
            <p className="text-[10px] text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">-</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CharacterPanel({ result }: { result: CharacterResult }) {
  const { character, stats, tags } = result;
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${character.accent}`}>
          <CharacterIcon icon={character.icon} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">your class</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{character.role}</h2>
          <p className="mt-1 text-sm text-blue-100">{character.title}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-slate-200">{character.summary}</p>

      <div className="grid grid-cols-5 gap-2">
        <Stat label="공격" value={stats.attack} />
        <Stat label="방어" value={stats.defense} />
        <Stat label="인내" value={stats.patience} />
        <Stat label="탐색" value={stats.research} />
        <Stat label="FOMO" value={stats.fomo} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">weakness</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{character.weakness}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">share line</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{character.tease}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function PartySection({
  result,
  friends,
  selectedFriendIds,
  onToggleFriend,
}: {
  result: CharacterResult | undefined;
  friends: FriendMember[];
  selectedFriendIds: string[];
  onToggleFriend: (id: string) => void;
}) {
  const members = result ? [{ id: "me", name: "나", ...result }, ...friends] : friends;
  const summary = result ? buildPartySummary(members) : undefined;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">party</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">친구 파티 조합</h2>
        </div>
        <p className="text-xs text-[var(--muted)]">v0는 샘플 친구 합류로 그룹 감각만 확인합니다</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">친구 합류시키기</p>
              <p className="text-xs text-[var(--muted)]">실제 초대 링크는 다음 PR에서 붙입니다.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {SAMPLE_FRIENDS.map((friend) => {
              const checked = selectedFriendIds.includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => onToggleFriend(friend.id)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    checked
                      ? "border-blue-400 bg-blue-50"
                      : "border-[var(--line)] bg-white hover:border-blue-300"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--ink)]">{friend.name}</span>
                    <span className="block text-xs text-[var(--muted)]">{friend.character.role}</span>
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-blue-700">
                    {checked ? "합류" : "대기"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          {!result ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Users className="h-8 w-8 text-slate-400" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-[var(--ink)]">내 캐릭터가 먼저 필요합니다</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
                취향 카드 3개를 고르면 내 캐릭터가 파티의 첫 멤버로 들어옵니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {members.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>

              {summary && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">party read</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{summary.headline}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{summary.note}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <MiniMetric label="공격" value={summary.stats.attack} />
                      <MiniMetric label="방어" value={summary.stats.defense} />
                      <MiniMetric label="탐색" value={summary.stats.research} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {summary.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MemberCard({ member }: { member: FriendMember }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${member.character.accent}`}>
          <CharacterIcon icon={member.character.icon} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--muted)]">{member.name}</p>
          <h3 className="truncate text-sm font-semibold text-[var(--ink)]">{member.character.role}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{member.character.tease}</p>
        </div>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-14 rounded-xl bg-white px-2 py-2">
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-2 text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function CharacterIcon({ icon }: { icon: Character["icon"] }) {
  const className = "h-7 w-7";
  if (icon === "shield") return <Shield className={className} aria-hidden />;
  if (icon === "flame") return <Flame className={className} aria-hidden />;
  if (icon === "radar") return <Radar className={className} aria-hidden />;
  if (icon === "gem") return <Gem className={className} aria-hidden />;
  return <Sparkles className={className} aria-hidden />;
}

function buildCharacter(cards: TasteCard[]): { character: Character; stats: StatScores; tags: string[] } {
  const raw = cards.reduce(
    (acc, card) => ({
      attack: acc.attack + card.stats.attack,
      defense: acc.defense + card.stats.defense,
      patience: acc.patience + card.stats.patience,
      research: acc.research + card.stats.research,
      fomo: acc.fomo + card.stats.fomo,
    }),
    EMPTY_STATS,
  );
  const stats = normalizeStats(raw, cards.length);
  const character = pickCharacter(stats);
  const tags = Array.from(new Set(cards.flatMap((card) => card.tags))).slice(0, 6);
  return { character, stats, tags };
}

function buildPartySummary(members: FriendMember[]): { headline: string; note: string; stats: StatScores; tags: string[] } {
  const totals = members.reduce(
    (acc, member) => ({
      attack: acc.attack + member.stats.attack,
      defense: acc.defense + member.stats.defense,
      patience: acc.patience + member.stats.patience,
      research: acc.research + member.stats.research,
      fomo: acc.fomo + member.stats.fomo,
    }),
    EMPTY_STATS,
  );
  const stats = {
    attack: Math.round(totals.attack / members.length),
    defense: Math.round(totals.defense / members.length),
    patience: Math.round(totals.patience / members.length),
    research: Math.round(totals.research / members.length),
    fomo: Math.round(totals.fomo / members.length),
  };
  const tags = Array.from(new Set(members.flatMap((member) => member.tags))).slice(0, 8);

  if (stats.attack >= 7 && stats.defense <= 4) {
    return {
      headline: "상승장 대화력은 강하지만 방어 담당이 부족합니다.",
      note: "오늘의 우정주는 성장성과 가격 부담이 동시에 갈리는 종목이 잘 맞습니다.",
      stats,
      tags,
    };
  }
  if (stats.defense >= 7 && stats.attack <= 5) {
    return {
      headline: "차분한 방어형 파티입니다.",
      note: "배당, 현금흐름, 저평가처럼 오래 이야기할 수 있는 주제가 잘 맞습니다.",
      stats,
      tags,
    };
  }
  if (stats.research >= 7) {
    return {
      headline: "자료를 뜯어보는 분석형 파티입니다.",
      note: "서로의 근거를 비교하기 좋은 종목이나 섹터를 던지면 대화가 오래 갑니다.",
      stats,
      tags,
    };
  }
  return {
    headline: "취향이 섞인 균형형 파티입니다.",
    note: "한 명은 공격하고 한 명은 말리는 구조가 나와서 레이드 대화 소재가 좋습니다.",
    stats,
    tags,
  };
}

function normalizeStats(stats: StatScores, count: number): StatScores {
  const scale = (value: number) => Math.max(1, Math.min(10, Math.round((value / count) * 2)));
  return {
    attack: scale(stats.attack),
    defense: scale(stats.defense),
    patience: scale(stats.patience),
    research: scale(stats.research),
    fomo: scale(stats.fomo),
  };
}

function pickCharacter(stats: StatScores): Character {
  if (stats.fomo >= 8 || (stats.attack >= 8 && stats.patience <= 4)) return CHARACTERS[4]!;
  if (stats.defense >= 8 && stats.patience >= 7) return CHARACTERS[1]!;
  if (stats.research >= 8 && stats.defense >= 6) return CHARACTERS[3]!;
  if (stats.research >= 8 && stats.attack <= 5) return CHARACTERS[5]!;
  if (stats.attack >= 8) return CHARACTERS[0]!;
  return CHARACTERS[2]!;
}
