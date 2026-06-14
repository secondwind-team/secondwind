"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buildFinzProfile, type FinzPartyPick } from "@/lib/common/services/finz";
import {
  getOrCreateMemberId,
  getRememberedMemberId,
  rememberPartyMembership,
} from "@/lib/common/finz-party-id";
import { FinzCharacterBuilder } from "./finz-character-builder";
import { FinzCharacterCard } from "./finz-character-card";
import { FinzPartyPickResult } from "./finz-party-pick-result";

type Member = { memberId: string; displayName: string; selectedCardIds: string[]; joinedAt: string };
type Group = { id: string; members: Member[]; createdAt: string; expiresAt: string; pick?: FinzPartyPick };

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

  useEffect(() => {
    setMyMemberId(getRememberedMemberId(initialGroup.id));
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, [initialGroup.id]);

  const isMember = myMemberId != null && group.members.some((m) => m.memberId === myMemberId);
  const full = group.members.length >= MAX_MEMBERS;
  const canJoin = !isMember && !full;
  // 친구 합류(빈 자리) 또는 파티 픽(가득 찼는데 아직 픽 없음)을 기다리는 동안 폴링.
  const shouldPoll = (isMember && !full) || (full && group.pick == null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/finz/party/${initialGroup.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { status: string; group?: Group };
      if (json.status === "ok" && json.group) setGroup(json.group);
    } catch {
      // 일시적 네트워크 실패는 무시 — 다음 폴링에서 회복.
    }
  }, [initialGroup.id]);

  useEffect(() => {
    if (!shouldPoll) return;
    let count = 0;
    const MAX_POLLS = 40; // ~3.3분. AI가 영구 장애로 픽이 저장되지 않을 때 무한 폴링 방지.
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
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
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
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-6 text-center"
            aria-label="친구를 기다리는 중"
          >
            <p className="text-sm font-semibold text-emerald-800">아직 빈 자리예요</p>
            <p className="text-sm text-[var(--muted)]">
              {isMember ? "친구에게 아래 링크를 보내 합류를 기다려보세요." : "아래에서 캐릭터를 만들고 합류하세요."}
            </p>
          </div>
        )}
      </div>

      {isMember && !full && (
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--ink)]">초대 링크</p>
            <p className="mt-0.5 break-all text-xs text-[var(--muted)]">{shareUrl}</p>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
      )}

      {canJoin && (
        <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">나도 캐릭터 만들고 합류하기</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">로그인 없이 취향 카드 3개만 고르면 이 파티에 합류해요.</p>
          </div>
          <FinzCharacterBuilder submitLabel="합류하기" pending={joining} onSubmit={join} />
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          )}
        </section>
      )}

      {full && (
        <section className="space-y-4">
          {group.pick ? (
            <>
              <FinzPartyPickResult pick={group.pick} />
              {isMember && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => openPick(true)}
                    disabled={opening}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-wait"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {opening ? "다시 뽑는 중" : "다른 우정주로 다시 뽑기"}
                  </button>
                </div>
              )}
            </>
          ) : isMember ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/60 p-6 text-center">
              <p className="text-sm font-semibold text-emerald-900">파티 완성! 두 캐릭터가 모였어요.</p>
              <p className="text-sm text-[var(--muted)]">이 조합에 맞는 오늘의 우정주를 열어보세요.</p>
              <button
                type="button"
                onClick={() => openPick(false)}
                disabled={opening}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:bg-emerald-300"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {opening ? "오늘의 우정주 여는 중" : "오늘의 우정주 열기"}
              </button>
            </div>
          ) : (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
              파티가 가득 찼어요. 친구가 오늘의 우정주를 여는 중이에요. 잠시만요.
            </p>
          )}
          {pickError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{pickError}</p>
          )}
        </section>
      )}
    </div>
  );
}
