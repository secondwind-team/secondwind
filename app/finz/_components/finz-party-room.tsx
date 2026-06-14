"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  buildFinzProfile,
  type FinzPartyPick,
  type FinzPartyPosition,
  type FinzPartyStance,
  type FinzPartySummary,
} from "@/lib/common/services/finz";
import {
  getOrCreateMemberId,
  getRememberedMemberId,
  rememberPartyMembership,
} from "@/lib/common/finz-party-id";
import { FinzCharacterBuilder } from "./finz-character-builder";
import { FinzCharacterCard } from "./finz-character-card";
import { FinzPartyPickResult } from "./finz-party-pick-result";
import { FinzPartyPositions } from "./finz-party-positions";
import { FinzPartySummaryCard } from "./finz-party-summary";

type Member = { memberId: string; displayName: string; selectedCardIds: string[]; joinedAt: string };
type Group = {
  id: string;
  members: Member[];
  createdAt: string;
  expiresAt: string;
  pick?: FinzPartyPick;
  positions?: FinzPartyPosition[];
  summary?: FinzPartySummary;
};

const MAX_MEMBERS = 2;

export function FinzPartyRoom({ initialGroup }: { initialGroup: Group }) {
  const [group, setGroup] = useState<Group>(initialGroup);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [opening, setOpening] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [submittingPosition, setSubmittingPosition] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    setMyMemberId(getRememberedMemberId(initialGroup.id));
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, [initialGroup.id]);

  const isMember = myMemberId != null && group.members.some((m) => m.memberId === myMemberId);
  const full = group.members.length >= MAX_MEMBERS;
  const canJoin = !isMember && !full;
  const positionsComplete =
    (group.positions?.length ?? 0) >= MAX_MEMBERS &&
    group.members.every((m) => (group.positions ?? []).some((p) => p.memberId === m.memberId));
  const shouldPoll =
    (isMember && !full) ||
    (full && group.pick == null) ||
    (full && group.pick != null && (!positionsComplete || group.summary == null));

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/finz/party/${initialGroup.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { status: string; group?: Group };
      if (json.status === "ok" && json.group) setGroup(json.group);
    } catch {
      // 일시적 네트워크 실패는 무시.
    }
  }, [initialGroup.id]);

  useEffect(() => {
    if (!shouldPoll) return;
    let count = 0;
    const MAX_POLLS = 40;
    const timer = setInterval(() => {
      count += 1;
      void refetch();
      if (count >= MAX_POLLS) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [shouldPoll, refetch]);

  async function join(selectedCardIds: string[], displayName: string) {
    setJoining(true);
    setError(null);
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${initialGroup.id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, displayName, selectedCardIds }),
      });
      const json = (await res.json()) as { status: string; group?: Group };
      if (res.status === 409) throw new Error("이 파티는 이미 2명으로 가득 찼어요.");
      if (!res.ok || json.status !== "ok") throw new Error("합류하지 못했어요. 잠시 뒤 다시 시도해주세요.");
      rememberPartyMembership(initialGroup.id, memberId);
      setMyMemberId(memberId);
      if (json.group) setGroup(json.group);
    } catch (e) {
      setError(e instanceof Error ? e.message : "합류하지 못했어요.");
    } finally {
      setJoining(false);
    }
  }

  async function openPick(force: boolean) {
    setOpening(true);
    setPickError(null);
    try {
      const res = await fetch(`/api/finz/party/${initialGroup.id}/pick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = (await res.json()) as { status: string; group?: Group };
      if (!res.ok || json.status !== "ok" || !json.group) {
        throw new Error("오늘의 우정주를 열지 못했어요. 잠시 뒤 다시 시도해주세요.");
      }
      setGroup(json.group);
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "오늘의 우정주를 열지 못했어요.");
    } finally {
      setOpening(false);
    }
  }

  async function submitPosition(stance: FinzPartyStance, note: string) {
    setSubmittingPosition(true);
    setPositionError(null);
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${initialGroup.id}/position`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, stance, note }),
      });
      const json = (await res.json()) as { status: string; group?: Group };
      if (!res.ok || json.status !== "ok" || !json.group) {
        throw new Error("포지션을 저장하지 못했어요. 잠시 뒤 다시 시도해주세요.");
      }
      setGroup(json.group);
    } catch (e) {
      setPositionError(e instanceof Error ? e.message : "포지션을 저장하지 못했어요.");
    } finally {
      setSubmittingPosition(false);
    }
  }

  async function openSummary() {
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/finz/party/${initialGroup.id}/pick/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { status: string; group?: Group };
      if (!res.ok || json.status !== "ok" || !json.group) {
        throw new Error("파티 요약을 만들지 못했어요. 잠시 뒤 다시 시도해주세요.");
      }
      setGroup(json.group);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "파티 요약을 만들지 못했어요.");
    } finally {
      setGeneratingSummary(false);
    }
  }

  function copyLink() {
    if (!shareUrl || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {group.members.map((m) => {
          const profile = buildFinzProfile(m.selectedCardIds);
          if (!profile) return null;
          return (
            <FinzCharacterCard
              key={m.memberId}
              character={profile.character}
              name={m.displayName}
              tags={profile.selectedTags}
              highlight={m.memberId === myMemberId}
            />
          );
        })}

        {!full && (
          <div
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-[#fbd9cf] bg-[var(--fz-coral-tint)] p-6 text-center"
            aria-label="친구를 기다리는 중"
          >
            <span className="text-3xl" aria-hidden>🪑</span>
            <p className="text-sm font-semibold text-[var(--fz-coral-ink)]">아직 빈 자리예요</p>
            <p className="text-sm text-[var(--fz-muted)]">
              {isMember ? "친구에게 아래 링크를 보내봐." : "아래에서 캐릭터를 만들고 합류해."}
            </p>
          </div>
        )}
      </div>

      {isMember && !full && (
        <div className="fz-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--fz-ink)]">초대 링크</p>
            <p className="mt-0.5 break-all text-xs text-[var(--fz-muted)]">{shareUrl}</p>
          </div>
          <button type="button" onClick={copyLink} className="fz-btn shrink-0">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
      )}

      {canJoin && (
        <section className="fz-card space-y-4 p-5">
          <div>
            <h2 className="fz-display text-xl text-[var(--fz-ink)]">나도 캐릭터 만들고 합류하기</h2>
            <p className="mt-1 text-sm text-[var(--fz-muted)]">로그인 없이 취향 카드 3개만 고르면 이 파티에 합류해.</p>
          </div>
          <FinzCharacterBuilder submitLabel="합류하기" pending={joining} onSubmit={join} />
          {error && <p className="fz-alert">{error}</p>}
        </section>
      )}

      {full && (
        <section className="space-y-4">
          {group.pick ? (
            <>
              <FinzPartyPickResult pick={group.pick} />
              {isMember && (
                <div className="flex justify-center">
                  <button type="button" onClick={() => openPick(true)} disabled={opening} className="fz-btn fz-btn--ghost">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {opening ? "다시 뽑는 중" : "다른 우정주로 다시 뽑기"}
                  </button>
                </div>
              )}

              <FinzPartyPositions
                members={group.members}
                positions={group.positions ?? []}
                myMemberId={myMemberId}
                submitting={submittingPosition}
                error={positionError}
                onSubmit={submitPosition}
              />

              {positionsComplete &&
                (group.summary ? (
                  <FinzPartySummaryCard summary={group.summary} />
                ) : isMember ? (
                  <div className="fz-card flex flex-col items-center gap-2 p-5 text-center">
                    <p className="text-sm text-[var(--fz-muted)]">둘 다 포지션을 남겼어요. AI 파티 요약을 만들어볼까?</p>
                    <button type="button" onClick={openSummary} disabled={generatingSummary} className="fz-btn">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      {generatingSummary ? "요약 만드는 중" : "AI 파티 요약 만들기"}
                    </button>
                    {summaryError && <p className="fz-alert">{summaryError}</p>}
                  </div>
                ) : (
                  <p className="fz-card p-4 text-center text-sm text-[var(--fz-muted)]">친구가 파티 요약을 만드는 중이에요. 잠시만.</p>
                ))}
            </>
          ) : isMember ? (
            <div className="fz-card flex flex-col items-center gap-3 bg-[var(--fz-coral-tint)] p-6 text-center">
              <span className="text-3xl" aria-hidden>🎉</span>
              <p className="text-sm font-semibold text-[var(--fz-coral-ink)]">파티 완성! 두 캐릭터가 모였어요.</p>
              <p className="text-sm text-[var(--fz-muted)]">이 조합에 맞는 오늘의 우정주를 열어봐.</p>
              <button type="button" onClick={() => openPick(false)} disabled={opening} className="fz-btn">
                <Sparkles className="h-4 w-4" aria-hidden />
                {opening ? "오늘의 우정주 여는 중" : "오늘의 우정주 열기"}
              </button>
            </div>
          ) : (
            <p className="fz-card p-4 text-center text-sm text-[var(--fz-muted)]">파티가 가득 찼어요. 친구가 오늘의 우정주를 여는 중이에요. 잠시만.</p>
          )}
          {pickError && <p className="fz-alert">{pickError}</p>}
        </section>
      )}
    </div>
  );
}
