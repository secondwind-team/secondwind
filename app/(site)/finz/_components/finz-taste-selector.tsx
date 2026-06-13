"use client";

import { Check, LogIn, LogOut, RotateCcw, Sparkles } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  FINZ_MIN_SELECTIONS,
  FINZ_TASTE_CARDS,
  getSelectedTasteCards,
  summonFinzCharacter,
  summarizeTasteTags,
  type FinzDailyPick,
  type FinzCharacter,
  type FinzCharacterStats,
} from "@/lib/common/services/finz";

const STAT_LABELS: Array<{ key: keyof FinzCharacterStats; label: string }> = [
  { key: "attack", label: "공격력" },
  { key: "defense", label: "방어력" },
  { key: "patience", label: "인내력" },
  { key: "research", label: "정보탐색력" },
  { key: "fomoRisk", label: "FOMO 위험" },
];

export function FinzTasteSelector() {
  const { data: session, status } = useSession();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [character, setCharacter] = useState<FinzCharacter | null>(null);
  const [saved, setSaved] = useState(false);
  const [dailyPick, setDailyPick] = useState<FinzDailyPick | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [generatingPick, setGeneratingPick] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCards = useMemo(
    () => getSelectedTasteCards(selectedIds),
    [selectedIds],
  );

  const selectedTagSummary = useMemo(
    () => summarizeTasteTags(selectedCards),
    [selectedCards],
  );

  const canSummon = selectedIds.length >= FINZ_MIN_SELECTIONS;
  const remaining = Math.max(FINZ_MIN_SELECTIONS - selectedIds.length, 0);
  const signedIn = status === "authenticated";

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setMessage(null);
      try {
        const [profileRes, pickRes] = await Promise.all([
          fetch("/api/finz/profile"),
          fetch("/api/finz/pick"),
        ]);

        if (!cancelled && profileRes.ok) {
          const profileJson = (await profileRes.json()) as {
            status: string;
            profile?: { selectedCardIds?: string[]; character?: FinzCharacter };
          };
          if (profileJson.status === "ok" && profileJson.profile?.selectedCardIds) {
            setSelectedIds(profileJson.profile.selectedCardIds);
            setCharacter(profileJson.profile.character ?? null);
            setSaved(true);
          }
        }

        if (!cancelled && pickRes.ok) {
          const pickJson = (await pickRes.json()) as {
            status: string;
            dailyPick?: { pick?: FinzDailyPick };
          };
          if (pickJson.status === "ok" && pickJson.dailyPick?.pick) {
            setDailyPick(pickJson.dailyPick.pick);
          }
        }
      } catch {
        if (!cancelled) {
          setMessage("저장된 FINZ 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  function toggleCard(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
    setCharacter(null);
    setSaved(false);
    setDailyPick(null);
    setMessage(null);
  }

  function handleSummon() {
    const nextCharacter = summonFinzCharacter(selectedIds);
    setCharacter(nextCharacter);
    setSaved(false);
    setDailyPick(null);
    setMessage(null);
  }

  function resetSelection() {
    setSelectedIds([]);
    setCharacter(null);
    setSaved(false);
    setDailyPick(null);
    setMessage(null);
  }

  async function saveProfile() {
    if (!character) return false;
    setSavingProfile(true);
    setMessage(null);
    try {
      const res = await fetch("/api/finz/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectedCardIds: selectedIds }),
      });
      if (!res.ok) throw new Error("profile-save-failed");
      setSaved(true);
      setMessage("FINZ 프로필을 저장했습니다.");
      return true;
    } catch {
      setMessage("FINZ 프로필을 저장하지 못했습니다.");
      return false;
    } finally {
      setSavingProfile(false);
    }
  }

  async function generateDailyPick(force = false) {
    if (!signedIn) {
      void signIn("google", { callbackUrl: "/finz" });
      return;
    }

    const nextCharacter = character ?? summonFinzCharacter(selectedIds);
    if (!nextCharacter) return;
    setCharacter(nextCharacter);

    const savedOk = saved || (await saveProfile());
    if (!savedOk) return;

    setGeneratingPick(true);
    setMessage(force ? "오늘의 우정주를 다시 고르는 중입니다." : "오늘의 우정주를 고르는 중입니다.");
    try {
      const res = await fetch("/api/finz/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = (await res.json()) as {
        status: string;
        reason?: string;
        fallback?: boolean;
        dailyPick?: { pick?: FinzDailyPick };
      };
      if (!res.ok || json.status !== "ok" || !json.dailyPick?.pick) {
        throw new Error(json.reason ?? "pick-failed");
      }
      setDailyPick(json.dailyPick.pick);
      setMessage(
        json.fallback
          ? "AI가 잠시 불안정해 기본 소재로 보여드려요. 잠시 뒤 다시 생성하면 맞춤 우정주를 받을 수 있어요."
          : "오늘의 우정주를 저장했습니다.",
      );
    } catch {
      setMessage("오늘의 우정주를 만들지 못했습니다. 잠시 뒤 다시 시도해주세요.");
    } finally {
      setGeneratingPick(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            taste cards
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
            끌리는 문장을 3개 이상 골라주세요
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            주식 지식이 없어도 괜찮습니다. 지금 고른 취향은 아래에서
            Lv.1 투자 캐릭터의 성격과 스탯으로 바뀝니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span className="font-semibold">{selectedIds.length}</span>
            <span className="text-emerald-800"> / {FINZ_MIN_SELECTIONS} 선택</span>
          </div>
          {signedIn ? (
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/finz" })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {session.user?.name ?? session.user?.email} 로그아웃
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn("google", { callbackUrl: "/finz" })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              Google 로그인
            </button>
          )}
        </div>
      </div>

      {loadingProfile && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
          저장된 FINZ 정보를 불러오는 중입니다.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FINZ_TASTE_CARDS.map((card) => {
          const selected = selectedIds.includes(card.id);

          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleCard(card.id)}
              className={`flex min-h-28 flex-col justify-between rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
                selected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-[var(--line)] bg-slate-50 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-sm"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold leading-relaxed text-[var(--ink)]">
                  {card.label}
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </span>
              <span className="mt-3 flex flex-wrap gap-1.5">
                {card.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {canSummon
              ? "캐릭터 소환 준비 완료"
              : `${remaining}개 더 고르면 캐릭터를 소환할 수 있어요`}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {selectedTagSummary.length > 0
              ? `현재 취향 태그: ${selectedTagSummary.join(", ")}`
              : "선택한 카드의 태그가 여기에 쌓입니다."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={resetSelection}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              다시 고르기
            </button>
          )}
          <button
            type="button"
            disabled={!canSummon}
            onClick={handleSummon}
            title={
              canSummon
                ? "선택한 카드 기반으로 캐릭터를 소환합니다"
                : "취향 카드를 3개 이상 선택해야 합니다"
            }
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              canSummon
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {character ? "다시 소환" : "캐릭터 소환"}
          </button>
        </div>
      </div>

      {character && (
        <CharacterResult
          character={character}
          selectedLabels={selectedCards.map((card) => card.label)}
          selectedTags={selectedTagSummary}
          signedIn={signedIn}
          saved={saved}
          savingProfile={savingProfile}
          generatingPick={generatingPick}
          dailyPick={dailyPick}
          message={message}
          onSave={() => void saveProfile()}
          onGenerate={() => void generateDailyPick(false)}
          onRegenerate={() => void generateDailyPick(true)}
          onSignIn={() => void signIn("google", { callbackUrl: "/finz" })}
        />
      )}
    </section>
  );
}

function CharacterResult({
  character,
  selectedLabels,
  selectedTags,
  signedIn,
  saved,
  savingProfile,
  generatingPick,
  dailyPick,
  message,
  onSave,
  onGenerate,
  onRegenerate,
  onSignIn,
}: {
  character: FinzCharacter;
  selectedLabels: string[];
  selectedTags: string[];
  signedIn: boolean;
  saved: boolean;
  savingProfile: boolean;
  generatingPick: boolean;
  dailyPick: FinzDailyPick | null;
  message: string | null;
  onSave: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onSignIn: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70">
      <div className="border-b border-emerald-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          character summoned
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
              {character.className}
            </h3>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              {character.levelTitle}
            </p>
          </div>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            {selectedTags.join(" / ")}
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          {character.summary}
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-emerald-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">스탯</h4>
            <div className="mt-4 space-y-3">
              {STAT_LABELS.map((stat) => (
                <div key={stat.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--muted)]">{stat.label}</span>
                    <span className="font-semibold text-[var(--ink)]">
                      {character.stats[stat.key]}
                    </span>
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

          <section className="rounded-xl border border-emerald-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">선택한 취향</h4>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
              {selectedLabels.map((label) => (
                <li key={label} className="flex gap-2">
                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-emerald-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">약점</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {character.weakness}
            </p>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">친구에게 공유할 한 줄</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {character.tease}
            </p>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-[var(--ink)]">다음 레이드 역할</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {character.roleMission}
            </p>
          </section>

          <div className="space-y-2">
            {!signedIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <LogIn className="h-4 w-4" aria-hidden />
                로그인하고 저장하기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={savingProfile || saved}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    saved
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {saved ? "프로필 저장됨" : savingProfile ? "저장 중" : "프로필 저장"}
                </button>
                <button
                  type="button"
                  onClick={dailyPick ? onRegenerate : onGenerate}
                  disabled={generatingPick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-300"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {generatingPick
                    ? "우정주 생성 중"
                    : dailyPick
                      ? "오늘의 우정주 다시 생성"
                      : "오늘의 우정주 생성"}
                </button>
              </>
            )}
            {message && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>

      {dailyPick && <DailyPickResult pick={dailyPick} />}
    </article>
  );
}

function DailyPickResult({ pick }: { pick: FinzDailyPick }) {
  return (
    <section className="border-t border-emerald-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            today&apos;s friendship stock
          </p>
          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {pick.name}
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {pick.oneLine}
          </p>
        </div>
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {pick.kind === "stock" ? "종목" : "테마"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PickList title="왜 오늘 이 소재인가" items={pick.whyThisFits} />
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h5 className="text-sm font-semibold text-[var(--ink)]">갈릴 포인트</h5>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {pick.debatePoint}
          </p>
        </section>
        <PickList title="첫 질문" items={pick.openingQuestions} />
        <PickList title="대화가 끊겼을 때" items={pick.conversationSeeds} />
      </div>

      <section className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
        <h5 className="text-sm font-semibold text-[var(--ink)]">내 캐릭터의 관점</h5>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {pick.rolePrompt}
        </p>
      </section>

      <PickList title="주의" items={pick.caveats} />
    </section>
  );
}

function PickList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-4">
      <h5 className="text-sm font-semibold text-[var(--ink)]">{title}</h5>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
