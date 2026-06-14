"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buildFinzProfile } from "@/lib/common/services/finz";
import type { FinzChatMemberLite } from "@/lib/common/services/finz-chat";
import { finzClassEmoji } from "./finz-character-card";

// 채팅방 상단 바 — 멤버 아바타 + 상태 라벨 + 초대 링크 복사. flex-none(타임라인 위에 고정).
export function FinzChatHeader({
  members,
  myMemberId,
  themeName,
  shareUrl,
  full,
}: {
  members: FinzChatMemberLite[];
  myMemberId: string | null;
  themeName: string | null;
  shareUrl: string;
  full: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  const stateLabel = themeName ? themeName : full ? "오늘의 우정주를 뽑아봐" : "친구를 기다리는 중";

  return (
    <div className="flex-none border-b border-[var(--fz-line)] bg-[var(--fz-bg)] px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex -space-x-2">
            {members.map((m) => {
              const profile = buildFinzProfile(m.selectedCardIds);
              return (
                <span
                  key={m.memberId}
                  title={m.displayName}
                  className={`fz-avatar h-8 w-8 text-sm ring-2 ring-[var(--fz-bg)] ${m.memberId === myMemberId ? "ring-[var(--fz-coral)]" : ""}`}
                >
                  {finzClassEmoji(profile?.character.classId)}
                </span>
              );
            })}
            {!full && (
              <span className="fz-avatar h-8 w-8 bg-[var(--fz-surface-2)] text-sm text-[var(--fz-muted)] ring-2 ring-[var(--fz-bg)]" aria-hidden>
                ＋
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">
              {members.map((m) => m.displayName).join(" · ")}
              {!full && members.length === 1 ? " · 빈자리 1" : ""}
            </p>
            <p className="truncate text-xs text-[var(--fz-muted)]">{stateLabel}</p>
          </div>
        </div>
        <button type="button" onClick={copyLink} className="fz-btn fz-btn--ghost shrink-0 px-3 py-1.5 text-xs">
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "복사됨" : "초대"}
        </button>
      </div>
    </div>
  );
}
