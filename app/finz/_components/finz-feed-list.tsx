"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Users } from "lucide-react";
import { type FinzFeedEvent } from "@/lib/common/services/finz-account";
import { summonFinzCharacter } from "@/lib/common/services/finz";
import { finzClassEmoji } from "./finz-character-card";

// ── 상대시각: "방금 전 / N분 전 / N시간 전 / N일 전 / M월 D일" ──
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  const d = new Date(then);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 액터 displayName 의 첫 글자(이모지/한글/영문 모두 안전하게) — 캐릭터 이모지가 없을 때 폴백.
function firstGrapheme(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "🙂";
  return Array.from(trimmed)[0] ?? "🙂";
}

// type 별 표시 문장 + (있으면) title 칩 노출 여부.
function describeEvent(ev: FinzFeedEvent): { sentence: string; showTitle: boolean } {
  switch (ev.type) {
    case "account_created":
      return { sentence: "핀즈를 시작했어요 🎉", showTitle: false };
    case "character_summoned": {
      const character = summonFinzCharacter(ev.actor.selectedCardIds);
      const cls = character?.className ?? "투자";
      return { sentence: `${cls} 캐릭터를 소환했어요`, showTitle: false };
    }
    case "room_created":
      return { sentence: "새 대화방을 열었어요", showTitle: false };
    case "pick_created":
      return { sentence: "우정주를 만들었어요", showTitle: true };
    case "raid_started":
      return { sentence: "레이드를 시작했어요", showTitle: true };
    case "challenge_done":
      return { sentence: "챌린지를 달성했어요", showTitle: true };
    default:
      return { sentence: "활동했어요", showTitle: true };
  }
}

function FeedAvatar({ actor }: { actor: FinzFeedEvent["actor"] }) {
  const character = summonFinzCharacter(actor.selectedCardIds);
  const glyph = character ? finzClassEmoji(character.classId) : firstGrapheme(actor.displayName);
  return (
    <span className="fz-avatar h-11 w-11 shrink-0 text-lg" aria-hidden>
      {glyph}
    </span>
  );
}

function FeedCard({ ev }: { ev: FinzFeedEvent }) {
  const { sentence, showTitle } = describeEvent(ev);
  return (
    <article className="fz-feed-card">
      <FeedAvatar actor={ev.actor} />
      <div className="fz-feed-card__body">
        <p className="text-sm leading-snug text-[var(--fz-ink)]">
          <span className="font-bold">{ev.actor.displayName}</span>
          <span className="text-[var(--fz-muted)]"> @{ev.actor.handle}</span>
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--fz-ink)]">{sentence}</p>
        {showTitle && ev.title && (
          <div className="mt-1.5">
            <span className="fz-tag">{ev.title}</span>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          <time className="text-xs text-[var(--fz-muted)]" dateTime={ev.createdAt}>
            {relativeTime(ev.createdAt)}
          </time>
          {ev.roomId && (
            <Link
              href={`/finz/party/${ev.roomId}`}
              className="text-xs font-semibold text-[var(--fz-coral-ink)]"
            >
              방 가기
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

type LoadState = "loading" | "ready" | "error";

export function FinzFeedList() {
  const [events, setEvents] = useState<FinzFeedEvent[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");

  const fetchFeed = useCallback(async () => {
    setLoad("loading");
    try {
      const res = await fetch("/api/finz/feed", { cache: "no-store" });
      const json = (await res.json()) as { status?: string; events?: FinzFeedEvent[] };
      if (res.ok && json.status === "ok" && Array.isArray(json.events)) {
        setEvents(json.events);
        setLoad("ready");
      } else {
        // 503 / needs-account 등 — 빈 상태로 안내(친구 추가 유도).
        setEvents([]);
        setLoad("ready");
      }
    } catch {
      setLoad("error");
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <p className="fz-seclabel">친구들 소식</p>
        <button
          type="button"
          onClick={() => void fetchFeed()}
          disabled={load === "loading"}
          className="fz-iconbtn h-9 w-9"
          aria-label="새로고침"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {load === "loading" && (
        <div className="fz-empty">
          <span className="fz-typing" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <p className="text-sm">소식을 불러오는 중…</p>
        </div>
      )}

      {load === "error" && (
        <div className="fz-empty">
          <span className="fz-empty__emoji" aria-hidden>
            😵‍💫
          </span>
          <p className="text-sm leading-relaxed">
            소식을 불러오지 못했어. 잠깐 뒤에 다시 시도해줘.
          </p>
          <button type="button" onClick={() => void fetchFeed()} className="fz-btn--ghost fz-btn mt-1">
            <RotateCcw className="h-4 w-4" aria-hidden />
            다시 시도
          </button>
        </div>
      )}

      {load === "ready" && events.length === 0 && (
        <div className="fz-empty">
          <span className="fz-empty__emoji" aria-hidden>
            🌱
          </span>
          <p className="text-sm leading-relaxed">
            아직 친구들의 소식이 없어요.
            <br />
            친구를 추가하면 여기 활동이 떠요.
          </p>
          <Link href="/finz/friends" className="fz-btn mt-1">
            <Users className="h-4 w-4" aria-hidden />
            친구 추가하러 가기
          </Link>
        </div>
      )}

      {load === "ready" && events.length > 0 && (
        <div>
          {events.map((ev) => (
            <FeedCard key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
