// 서버 전용: 대화방(group) → 메신저 목록용 요약(FinzRoomSummary) 변환. 라우트·SSR 공용.
import type { FinzAccountSummary, FinzRoomSummary } from "@/lib/common/services/finz-account";
import {
  getFinzGroup,
  listRoomIdsForAccount,
  removeRoomFromAccountIndex,
  type FinzGroup,
  type FinzGroupMember,
} from "./finz-group-store";
import { getRoomLastMessage } from "./finz-chat-store";

export function memberToSummary(m: FinzGroupMember): FinzAccountSummary {
  return {
    accountId: m.memberId,
    handle: m.handle ?? "",
    displayName: m.displayName,
    selectedCardIds: m.selectedCardIds,
  };
}

// 목록에 보일 방 제목: self 는 "나와의 채팅", 그룹은 title/상대 이름 나열, 1on1 은 상대 displayName.
export function roomTitle(group: FinzGroup, meAccountId: string): string {
  if (group.kind === "self") return group.title || "나와의 채팅";
  const others = group.members.filter((m) => m.memberId !== meAccountId);
  if (group.kind === "group") {
    if (group.title) return group.title;
    if (others.length === 0) return "새 대화방";
    const names = others.map((m) => m.displayName);
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}명` : names.join(", ");
  }
  return others[0]?.displayName ?? group.members[0]?.displayName ?? "대화";
}

export function buildRoomSummary(
  group: FinzGroup,
  meAccountId: string,
  last: { text: string; createdAt: string } | null,
): FinzRoomSummary {
  return {
    roomId: group.id,
    kind: group.kind,
    title: roomTitle(group, meAccountId),
    participants: group.members.map(memberToSummary),
    lastActiveAt: last?.createdAt ?? group.createdAt,
    preview: last?.text,
  };
}

// 내 대화방 목록(최근 활동순, self 제외). API GET 과 SSR 페이지가 공용으로 쓴다.
// 방마다 group + 마지막 메시지를 병렬 조회. 소멸한 방은 인덱스에서 self-heal.
export async function listRoomsForAccount(meAccountId: string): Promise<FinzRoomSummary[]> {
  const ids = await listRoomIdsForAccount(meAccountId);
  const settled = await Promise.all(
    ids.map(async (id) => {
      const [group, last] = await Promise.all([getFinzGroup(id), getRoomLastMessage(id)]);
      if (!group) {
        void removeRoomFromAccountIndex(meAccountId, id).catch(() => {});
        return null;
      }
      if (group.kind === "self") return null; // 나와의 채팅은 목록에서 제외(상단 고정)
      return buildRoomSummary(group, meAccountId, last);
    }),
  );
  return settled.filter((r): r is FinzRoomSummary => r !== null);
}
