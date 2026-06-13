import Link from "next/link";
import type { Metadata } from "next";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { FinzPartyRoom } from "../../_components/finz-party-room";

// 폴링/룸이 항상 최신 멤버를 받도록 정적 캐시를 끈다.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ groupId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;
  return group
    ? { title: "FINZ 파티", description: "친구들과 투자 캐릭터 파티를 모읍니다." }
    : { title: "FINZ 파티", description: "링크가 만료되었거나 잘못된 주소입니다." };
}

export default async function FinzPartyRoomPage({ params }: Props) {
  const { groupId } = await params;
  const group = isFinzGroupId(groupId) ? await getFinzGroup(groupId) : null;

  if (!group) {
    return (
      <div className="space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-emerald-500" />
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">FINZ · 파티</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            파티를 찾지 못했어요.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            링크가 만료되었거나 잘못된 주소입니다. 파티 링크는 만든 뒤 7일 동안 열 수 있어요.
          </p>
        </header>
        <Link
          href="/finz/party"
          className="inline-flex rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-soft)] transition hover:border-emerald-300 hover:text-emerald-700"
        >
          새 파티 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-emerald-500" />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">FINZ · 파티</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
          우리 파티의 투자 캐릭터들.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          취향이 다른 캐릭터가 한 파티에 모이면, 다음 단계에서 이 조합에 맞는 오늘의 우정주 대화가 열립니다.
        </p>
      </header>

      <FinzPartyRoom initialGroup={group} />
    </div>
  );
}
