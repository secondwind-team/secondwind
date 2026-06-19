"use client";

import { MessageCirclePlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FinzRoomSummary } from "@/lib/common/services/finz-account";
import { useFinzAccount } from "@/app/finz/_components/finz-account-context";
import { FinzNewChatSheet } from "@/app/finz/_components/finz-new-chat-sheet";

// 대화 탭: 내 대화방 목록(최근순) + 새 대화(1:1/그룹) 시작. 방을 탭하면 채팅방으로.
export default function FinzChatsPage() {
  const me = useFinzAccount();
  const router = useRouter();
  const [rooms, setRooms] = useState<FinzRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finz/rooms", { cache: "no-store" });
      const json = (await res.json()) as { status: string; rooms?: FinzRoomSummary[] };
      if (json.status === "ok") setRooms(json.rooms ?? []);
    } catch {
      // 무시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pb-6">
      <div className="border-b border-[var(--fz-line)] px-4 py-3">
        <button type="button" onClick={() => setSheetOpen(true)} className="fz-btn w-full">
          <MessageCirclePlus className="h-4 w-4" aria-hidden />
          새 대화 시작
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--fz-muted)]">불러오는 중…</p>
      ) : rooms.length === 0 ? (
        <div className="fz-empty">
          <span className="fz-empty__emoji" aria-hidden>💬</span>
          <p className="text-sm">아직 대화방이 없어.<br />친구와 1:1로, 또는 여럿이 모여 대화를 시작해봐.</p>
          <button type="button" onClick={() => setSheetOpen(true)} className="fz-btn mt-1">
            새 대화 시작
          </button>
        </div>
      ) : (
        <section>
          {rooms.map((room) => (
            <RoomRow key={room.roomId} room={room} meId={me.accountId} onOpen={() => router.push(`/finz/party/${room.roomId}`)} />
          ))}
        </section>
      )}

      {sheetOpen && (
        <FinzNewChatSheet
          onClose={() => setSheetOpen(false)}
          onCreated={(roomId) => router.push(`/finz/party/${roomId}`)}
        />
      )}
    </div>
  );
}

function RoomRow({ room, meId, onOpen }: { room: FinzRoomSummary; meId: string; onOpen: () => void }) {
  const others = room.participants.filter((p) => p.accountId !== meId);
  const isGroup = room.kind === "group";
  const initial = (isGroup ? room.title : others[0]?.displayName ?? room.title).trim().charAt(0) || "?";
  return (
    <button type="button" onClick={onOpen} className="fz-list-row">
      <span className="fz-avatar h-12 w-12 shrink-0 text-lg font-bold" aria-hidden>
        {isGroup ? <Users className="h-5 w-5" /> : initial}
      </span>
      <div className="fz-list-row__body">
        <div className="fz-list-row__title">
          {room.title}
          {isGroup && <span className="ml-1.5 text-xs font-normal text-[var(--fz-muted)]">· {room.participants.length}</span>}
        </div>
        <div className="fz-list-row__sub">{room.preview ?? "새 대화방 — 인사로 시작해봐"}</div>
      </div>
      <div className="fz-list-row__meta">{relativeTime(room.lastActiveAt)}</div>
    </button>
  );
}

function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일`;
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
