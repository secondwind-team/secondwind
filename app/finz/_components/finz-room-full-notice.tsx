import Link from "next/link";

// 비멤버가 이미 2명 찬 방을 열었을 때 — 사생활상 채팅 타임라인은 보여주지 않고 새 파티 CTA 만.
export function FinzRoomFullNotice() {
  return (
    <div className="space-y-5 px-4 pb-24 pt-5">
      <header className="fz-bubble p-5 sm:p-6">
        <p className="fz-seclabel">finz · 파티</p>
        <h1 className="fz-display mt-2 text-2xl text-[var(--fz-ink)]">이 파티는 이미 둘이 찼어요.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          FINZ 파티는 둘이서 하는 채팅이에요. 새 파티를 만들어 다른 친구와 우정주 수다를 시작해봐.
        </p>
      </header>
      <Link href="/finz/party" className="fz-btn">
        새 파티 만들기
      </Link>
    </div>
  );
}
