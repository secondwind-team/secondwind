// 서버 전용: 대화방(group) → 메신저 목록용 요약(FinzRoomSummary) 변환. 라우트 공용.
import type { FinzAccountSummary, FinzRoomSummary } from "@/lib/common/services/finz-account";
import type { FinzGroup, FinzGroupMember } from "./finz-group-store";

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
