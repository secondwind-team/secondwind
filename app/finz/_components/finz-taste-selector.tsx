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
} from "@/lib/common/services/finz";
import { FinzCharacterCard } from "./finz-character-card";

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

  const selectedCards = useMemo(() => getSelectedTasteCards(selectedIds), [selectedIds]);
  const selectedTagSummary = useMemo(() => summarizeTasteTags(selectedCards), [selectedCards]);

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
        const [profileRes, pickRes] = await Promise.all([fetch("/api/finz/profile"), fetch("/api/finz/pick")]);

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
          const pickJson = (await pickRes.json()) as { status: string; dailyPick?: { pick?: FinzDailyPick } };
          if (pickJson.status === "ok" && pickJson.dailyPick?.pick) {
            setDailyPick(pickJson.dailyPick.pick);
          }
        }
      } catch {
        if (!cancelled) setMessage("저장된 FINZ 정보를 불러오지 못했어요.");
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
      current.includes(id) ? current.filter((sid) => sid !== id) : [...current, id],
    );
    setCharacter(null);
    setSaved(false);
    setDailyPick(null);
    setMessage(null);
  }

  function handleSummon() {
    setCharacter(summonFinzCharacter(selectedIds));
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
      setMessage("FINZ 프로필을 저장했어요.");
      return true;
    } catch {
      setMessage("FINZ 프로필을 저장하지 못했어요.");
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
    setMessage(force ? "오늘의 우정주를 다시 고르는 중이에요." : "오늘의 우정주를 고르는 중이에요.");
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
          : "오늘의 우정주를 저장했어요.",
      );
    } catch {
      setMessage("오늘의 우정주를 만들지 못했어요. 잠시 뒤 다시 시도해주세요.");
    } finally {
      setGeneratingPick(false);
    }
  }

  return (
    <section className="fz-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="fz-seclabel">taste cards</p>
          <h2 className="fz-display mt-2 text-xl text-[var(--fz-ink)]">끌리는 문장을 3개 이상 골라줘</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">
            주식 지식 없어도 괜찮아요. 지금 고른 취향이 아래에서 Lv.1 투자 캐릭터로 바뀌어요.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className="fz-tag">
            {selectedIds.length} / {FINZ_MIN_SELECTIONS} 선택
          </span>
          {signedIn ? (
            <button type="button" onClick={() => void signOut({ callbackUrl: "/finz" })} className="fz-btn fz-btn--ghost px-3 py-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {session.user?.name ?? session.user?.email} 로그아웃
            </button>
          ) : (
            <button type="button" onClick={() => void signIn("google", { callbackUrl: "/finz" })} className="fz-btn px-3 py-1.5 text-xs">
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              Google 로그인
            </button>
          )}
        </div>
      </div>

      {loadingProfile && <p className="fz-alert">저장된 FINZ 정보를 불러오는 중이에요.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {FINZ_TASTE_CARDS.map((card) => {
          const selected = selectedIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleCard(card.id)}
              className={`flex min-h-24 flex-col justify-between rounded-[20px] border p-4 text-left transition active:scale-[0.98] ${
                selected
                  ? "border-transparent bg-[var(--fz-coral-tint)] shadow-[var(--fz-shadow-sm)]"
                  : "border-[var(--fz-line)] bg-[var(--fz-surface)] hover:border-[var(--fz-coral)]"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold leading-relaxed text-[var(--fz-ink)]">{card.label}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-transparent bg-[var(--fz-coral)] text-white" : "border-[var(--fz-line)] bg-[var(--fz-surface)] text-transparent"
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

      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--fz-ink)]">
            {canSummon ? "캐릭터 소환 준비 완료 ✨" : `${remaining}개 더 고르면 소환할 수 있어요`}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">
            {selectedTagSummary.length > 0 ? `취향 태그: ${selectedTagSummary.join(", ")}` : "고른 카드의 태그가 여기 쌓여요."}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button type="button" onClick={resetSelection} className="fz-btn fz-btn--ghost">
              <RotateCcw className="h-4 w-4" aria-hidden />
              다시 고르기
            </button>
          )}
          <button type="button" disabled={!canSummon} onClick={handleSummon} className="fz-btn disabled:cursor-not-allowed disabled:opacity-50">
            <Sparkles className="h-4 w-4" aria-hidden />
            {character ? "다시 소환" : "캐릭터 소환"}
          </button>
        </div>
      </div>

      {character && (
        <div className="space-y-4">
          <FinzCharacterCard character={character} tags={selectedTagSummary} />

          <div className="space-y-2">
            {!signedIn ? (
              <button type="button" onClick={() => void signIn("google", { callbackUrl: "/finz" })} className="fz-btn w-full">
                <LogIn className="h-4 w-4" aria-hidden />
                로그인하고 저장하기
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  disabled={savingProfile || saved}
                  className="fz-btn fz-btn--ghost flex-1 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {saved ? "프로필 저장됨" : savingProfile ? "저장 중" : "프로필 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => void generateDailyPick(Boolean(dailyPick))}
                  disabled={generatingPick}
                  className="fz-btn flex-1"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {generatingPick ? "우정주 생성 중" : dailyPick ? "오늘의 우정주 다시 생성" : "오늘의 우정주 생성"}
                </button>
              </div>
            )}
            {message && <p className="fz-alert bg-[var(--fz-amber-tint)] border-[#fbe6bd] text-[var(--fz-amber-ink)]">{message}</p>}
          </div>

          {dailyPick && <DailyPickResult pick={dailyPick} />}
        </div>
      )}
    </section>
  );
}

function DailyPickResult({ pick }: { pick: FinzDailyPick }) {
  return (
    <section className="fz-bubble fz-bubble--pick p-5">
      <span className="fz-tag">오늘의 우정주 · {pick.kind === "stock" ? "종목" : "테마"}</span>
      <h4 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">{pick.name}</h4>
      <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">{pick.oneLine}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PickList title="왜 오늘 이 소재인가" items={pick.whyThisFits} />
        <div className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface-2)] p-4">
          <h5 className="text-sm font-semibold text-[var(--fz-ink)]">갈릴 포인트</h5>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">{pick.debatePoint}</p>
        </div>
        <PickList title="첫 질문" items={pick.openingQuestions} />
        <PickList title="대화가 끊겼을 때" items={pick.conversationSeeds} />
      </div>

      <div className="mt-3 rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-4">
        <h5 className="text-sm font-semibold text-[var(--fz-ink)]">내 캐릭터의 관점</h5>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">{pick.rolePrompt}</p>
      </div>

      <div className="mt-3">
        <PickList title="주의" items={pick.caveats} />
      </div>
    </section>
  );
}

function PickList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[20px] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-4">
      <h5 className="text-sm font-semibold text-[var(--fz-ink)]">{title}</h5>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--fz-muted)]">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--fz-coral)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
