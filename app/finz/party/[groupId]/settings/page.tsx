import Link from "next/link";
import type { Metadata } from "next";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { listRecurringForRoom } from "@/lib/server/finz-recurring-store";
import { isBriefingSubscribed, MORNING_ECONOMY_BRIEFING_ID } from "@/lib/server/finz-briefing-store";
import { listTrades } from "@/lib/server/finz-portfolio-store";
import { FinzRoomSettings } from "../../../_components/finz-room-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "채팅방 설정", description: "정기 메시지 등 대화방 설정." };

type Props = { params: Promise<{ groupId: string }> };

export default async function FinzRoomSettingsPage({ params }: Props) {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;

  if (!group) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="fz-seclabel">finz · 채팅방 설정</p>
        <h1 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">대화방을 찾지 못했어요.</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--fz-muted)]">
          링크가 만료됐거나 잘못된 주소예요.
        </p>
        <Link href="/finz/chats" className="fz-btn mt-6">
          대화 목록으로
        </Link>
      </div>
    );
  }

  const [items, briefingSubscribed, trades] = await Promise.all([
    listRecurringForRoom(groupId),
    isBriefingSubscribed(MORNING_ECONOMY_BRIEFING_ID, groupId),
    listTrades(groupId),
  ]);

  const roomTitle =
    group.kind === "self" ? "나와의 채팅" : group.title || group.members.map((m) => m.displayName).join(" · ");

  return (
    <FinzRoomSettings
      groupId={groupId}
      roomTitle={roomTitle}
      memberIds={group.members.map((m) => m.memberId)}
      initialItems={items}
      initialBriefingSubscribed={briefingSubscribed}
      initialTrades={trades}
    />
  );
}
