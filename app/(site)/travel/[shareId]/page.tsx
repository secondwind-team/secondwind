import Link from "next/link";
import type { Metadata } from "next";
import { TravelForm } from "../_components/travel-form";
import { TravelHero } from "../_components/travel-hero";
import { enumeratePoints } from "@/lib/common/services/travel";
import { getTravelShare, isShareId } from "@/lib/server/travel-share-store";

type Props = {
  params: Promise<{ shareId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const snapshot = isShareId(shareId) ? await getTravelShare(shareId) : null;
  if (!snapshot) {
    return {
      title: "shared travel",
      description: "공유 링크가 만료되었거나 잘못된 주소입니다.",
    };
  }
  const { input, plan } = snapshot;
  const dayCount = plan.days.length;
  const placeCount = enumeratePoints(plan).length;
  const title = `${input.destination} 여행 ${dayCount}일 일정`;
  const description = `${input.startDate} ~ ${input.endDate} · ${dayCount}일 · 장소 ${placeCount}곳`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharedTravelPage({ params }: Props) {
  const { shareId } = await params;
  const snapshot = isShareId(shareId) ? await getTravelShare(shareId) : null;

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <TravelHero
          eyebrow="shared travel"
          title="공유 링크를 찾지 못했어요."
          description="공유 링크가 만료되었거나 잘못된 주소입니다. 새 여행 계획을 다시 만들 수 있어요."
          badge="공유 링크는 생성 후 7일 동안 열 수 있습니다."
        />
        <Link
          href="/travel"
          className="inline-flex rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-[var(--shadow-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          새 여행 계획 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TravelHero
        eyebrow="shared travel"
        title={
          <>
            받은 여행,
            <br />
            다시 고르면 되게.
          </>
        }
        description="공유받은 입력값과 여행 계획입니다. 필요한 부분을 고쳐서 다시 만들 수 있어요."
        badge={`${formatSharedDate(snapshot.expiresAt)}까지 열 수 있습니다.`}
      />

      <TravelForm
        initialInput={snapshot.input}
        initialPlan={snapshot.plan}
        initialModel={snapshot.model}
      />
    </div>
  );
}

function formatSharedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "7일 동안";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
