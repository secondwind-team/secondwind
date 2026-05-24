import Link from "next/link";
import { ServiceCard } from "@/components/common/service-card";

export default function LandingPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-soft)] sm:p-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          one studio dashboard
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl sm:leading-tight">
          덜 짜도 되는 도구들.
          <br />
          필요한 결정만 남깁니다.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          secondwind 는 3명 (지헌·태훈·덕우) 이 같이 운영하는 작은 실험장입니다.
          각자 하나씩 서비스를 올리고, 인프라·UI·배포만 공유합니다. 첫 서비스는
          여행 결정을 줄여주는 `/travel` 입니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/travel" className="block md:col-span-2">
          <ServiceCard
            title="travel"
            owner="지헌"
            status="ready"
            summary="J 강박에 쓰이는 여행 계획. 더 적은 결정으로 하나의 확정안을 받습니다."
          />
        </Link>
        <Link href="/finz" className="block">
          <ServiceCard
            title="FINZ"
            owner="덕우"
            status="ready"
            summary="친구들의 투자 취향을 캐릭터로 만들고 오늘의 우정주 대화를 시작합니다."
          />
        </Link>
        <ServiceCard
          title="diary"
          owner="태훈"
          status="coming-soon"
          summary="준비 중"
        />
      </section>
    </div>
  );
}
