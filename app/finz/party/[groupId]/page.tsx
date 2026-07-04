import Link from "next/link";
import type { Metadata } from "next";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { getChatTail } from "@/lib/server/finz-chat-store";
import { resolveAccount } from "@/lib/server/finz-account";
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
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="fz-seclabel">finz · 대화방</p>
        <h1 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">대화방을 찾지 못했어요.</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--fz-muted)]">
          링크가 만료됐거나 잘못된 주소예요. 대화방은 마지막 활동 뒤 30일 동안 열 수 있어.
        </p>
        <Link href="/finz/chats" className="fz-btn mt-6">
          대화 목록으로
        </Link>
      </div>
    );
  }

  // 멤버에게만 대화를 SSR 시드한다(비멤버에겐 페이지 소스로도 메시지·포트폴리오가 새지 않게).
  // 비멤버는 빈 시드 → 룸이 join-view 를 보여주고, 합류 후 폴링(세션 인증)으로 대화가 채워진다.
  // 멤버 미리보기(아바타·제목)는 group.members 로 충분하므로 그대로 시드한다.
  const me = await resolveAccount();
  const isMember = me.status === "ok" && group.members.some((m) => m.memberId === me.account.accountId);
  const tail = isMember ? await getChatTail(groupId, -1) : { messages: [], cursor: -1, revision: 0 };

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
      initialRevision={tail.revision}
      initialFull={group.members.length >= 2}
      initialKind={group.kind}
      initialTitle={group.title}
      initialChatMode={group.chatMode}
      // Blob 스토어가 연결됐을 때만 첨부 UI 노출(미프로비저닝 시 깨진 버튼 방지 — 토큰 세팅 후 자동 표시).
      attachmentsEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
    />
  );
}
