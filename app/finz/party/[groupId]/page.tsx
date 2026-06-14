import Link from "next/link";
import type { Metadata } from "next";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { FinzPartyRoom } from "../../_components/finz-party-room";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ groupId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;
  return group
    ? { title: "파티", description: "친구들과 투자 캐릭터 파티를 모읍니다." }
    : { title: "파티", description: "링크가 만료되었거나 잘못된 주소입니다." };
}

export default async function FinzPartyRoomPage({ params }: Props) {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;

  if (!group) {
    return (
      <div className="space-y-4">
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

  return (
    <div className="space-y-5">
      <header className="fz-bubble p-5 sm:p-6">
        <p className="fz-seclabel">finz · 파티</p>
        <h1 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">우리 파티의 투자 캐릭터들.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          취향이 다른 캐릭터가 한 파티에 모이면, 그 조합에 맞는 오늘의 우정주 대화가 열려.
        </p>
      </header>

      <FinzPartyRoom initialGroup={group} />
    </div>
  );
}
