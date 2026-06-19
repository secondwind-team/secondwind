"use client";

import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { buildFinzProfile } from "@/lib/common/services/finz";
import type { FinzChatMemberLite } from "@/lib/common/services/finz-chat";
import { finzClassEmoji } from "./finz-character-card";

// 채팅방 상단 바 — 뒤로(대화 목록) + 멤버 아바타 + 상태 라벨 + 초대. flex-none(타임라인 위에 고정).
export function FinzChatHeader({
  members,
  myMemberId,
  themeName,
  roomTitle,
  full,
  onInvite,
}: {
  members: FinzChatMemberLite[];
  myMemberId: string | null;
  themeName: string | null;
  roomTitle: string | null;
  full: boolean;
  onInvite?: () => void; // 없으면 초대 버튼 숨김(나와의 채팅 등)
}) {
  // 그룹은 방 이름, 1:1 은 멤버 이름 나열을 제목으로.
  const title = roomTitle || members.map((m) => m.displayName).join(" · ") || "대화방";
  const stateLabel = themeName
    ? themeName
    : roomTitle
      ? `${members.length}명`
      : full
        ? "오늘의 우정주를 뽑아봐"
        : "친구를 기다리는 중";

  return (
    <div className="flex-none border-b border-[var(--fz-line)] bg-[var(--fz-bg)] px-2 py-2.5">
      <div className="flex items-center gap-1">
        <Link href="/finz/chats" className="fz-iconbtn h-9 w-9 shrink-0 border-none bg-transparent shadow-none" aria-label="대화 목록으로">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex -space-x-2">
            {members.slice(0, 3).map((m) => {
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
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">{title}</p>
            <p className="truncate text-xs text-[var(--fz-muted)]">{stateLabel}</p>
          </div>
        </div>
        {onInvite && (
          <button type="button" onClick={onInvite} className="fz-btn fz-btn--ghost shrink-0 px-3 py-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            초대
          </button>
        )}
      </div>
    </div>
  );
}
