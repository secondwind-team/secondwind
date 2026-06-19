"use client";

import { LogIn } from "lucide-react";
import { buildFinzProfile } from "@/lib/common/services/finz";
import type { FinzRoomKind } from "@/lib/common/services/finz-account";
import type { FinzChatMemberLite } from "@/lib/common/services/finz-chat";
import { finzClassEmoji } from "./finz-character-card";

// 비멤버가 방 링크로 들어왔을 때 — 취향 재선택 없이 내 계정 캐릭터로 원탭 합류.
export function FinzRoomJoinView({
  kind,
  title,
  members,
  joining,
  error,
  onJoin,
}: {
  kind: FinzRoomKind;
  title: string;
  members: FinzChatMemberLite[];
  joining: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const names = members.map((m) => m.displayName);
  const heading =
    kind === "group" && title
      ? title
      : names.length > 0
        ? `${names.slice(0, 2).join(", ")}님의 대화방`
        : "대화방 초대";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex -space-x-2">
        {members.slice(0, 4).map((m) => {
          const profile = buildFinzProfile(m.selectedCardIds);
          return (
            <span key={m.memberId} className="fz-avatar h-12 w-12 text-lg ring-2 ring-[var(--fz-bg)]" title={m.displayName}>
              {finzClassEmoji(profile?.character.classId)}
            </span>
          );
        })}
      </div>
      <p className="fz-seclabel mt-5">finz · 대화방 초대</p>
      <h1 className="fz-display mt-2 text-2xl leading-tight text-[var(--fz-ink)]">{heading}</h1>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--fz-muted)]">
        {names.length > 0 ? `${names.join(", ")} 와 함께하는 대화방이야.` : "대화방에 초대됐어."} 내 캐릭터로 바로 들어갈 수 있어.
      </p>
      <button type="button" onClick={onJoin} disabled={joining} className="fz-btn mt-7 w-full max-w-xs">
        <LogIn className="h-4 w-4" aria-hidden />
        {joining ? "들어가는 중…" : "대화방 들어가기"}
      </button>
      {error && <p className="fz-alert mt-3 max-w-xs">{error}</p>}
    </div>
  );
}
