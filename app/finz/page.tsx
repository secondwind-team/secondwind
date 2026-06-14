import Link from "next/link";
import { FinzTasteSelector } from "./_components/finz-taste-selector";

export default function FinzPage() {
  return (
    <div className="space-y-5">
      <header className="fz-bubble fz-bubble--pick p-5 sm:p-6">
        <p className="fz-seclabel">finz · 핀즈</p>
        <h1 className="fz-display mt-2 text-2xl leading-tight text-[var(--fz-ink)] sm:text-3xl">
          친구랑 오늘 이야기할
          <br />
          우정주를 골라봐.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          어려운 종목 검색 대신 취향 카드부터. 고른 취향으로 투자 캐릭터를 소환하고, 친구와 파티를 이뤄 오늘의 우정주로 수다를 시작해.
        </p>
        <p className="mt-3 inline-block rounded-[var(--fz-r-full)] bg-[var(--fz-amber-tint)] px-3 py-1.5 text-xs font-medium text-[var(--fz-amber-ink)]">
          투자 조언이 아니라 친구들과 이야기할 대화 소재를 만드는 실험이에요.
        </p>
      </header>

      <section className="fz-card flex flex-col gap-3 bg-[var(--fz-surface-2)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--fz-ink)]">친구와 함께 하고 싶다면?</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">
            로그인 없이 파티를 만들고 초대 링크를 보내면, 친구 캐릭터와 한 파티에 모일 수 있어.
          </p>
        </div>
        <Link href="/finz/party" className="fz-btn shrink-0">
          친구와 함께 파티 만들기
        </Link>
      </section>

      <FinzTasteSelector />
    </div>
  );
}
