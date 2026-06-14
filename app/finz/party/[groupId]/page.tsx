import Link from "next/link";
import type { Metadata } from "next";
import { MAX_MEMBERS, getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { getChatTail } from "@/lib/server/finz-chat-store";
import { FinzPartyRoom } from "../../_components/finz-party-room";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ groupId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;
  return group
    ? { title: "파티", description: "친구와 우정주 채팅방." }
    : { title: "파티", description: "링크가 만료되었거나 잘못된 주소입니다." };
}

export default async function FinzPartyRoomPage({ params }: Props) {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;

  if (!group) {
    return (
      <div className="space-y-4 px-4 pb-24 pt-5">
        <header className="fz-bubble p-5 sm:p-6">
          <p className="fz-seclabel">finz · 파티</p>
          <h1 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">파티를 찾지 못했어요.</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
            링크가 만료됐거나 잘못된 주소예요. 파티 링크는 만든 뒤 7일 동안 열 수 있어.
          </p>
        </header>
        <Link href="/finz/party" className="fz-btn">
          새 파티 만들기
        </Link>
      </div>
    );
  }

  // 첫 페인트에 전체 대화를 SSR(깜빡임 없음). 멤버/풀블리드 여부는 룸이 클라이언트에서 결정.
  const tail = await getChatTail(groupId, -1);

  return (
    <FinzPartyRoom
      groupId={groupId}
      initialMembers={group.members.map((m) => ({
        memberId: m.memberId,
        displayName: m.displayName,
        selectedCardIds: m.selectedCardIds,
        joinedAt: m.joinedAt,
      }))}
      initialMessages={tail.messages}
      initialCursor={tail.cursor}
      initialFull={group.members.length >= MAX_MEMBERS}
    />
  );
}
