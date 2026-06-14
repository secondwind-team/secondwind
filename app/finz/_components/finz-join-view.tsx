"use client";

import { FinzCharacterBuilder } from "./finz-character-builder";

// 비멤버(합류 가능)용 전체 화면 — 캐릭터 빌더는 자체 스크롤이 필요해 컴포저 슬롯에 못 들어간다.
// 합류 성공 후에야 부모가 풀블리드 메신저로 전환한다.
export function FinzJoinView({
  inviterName,
  joining,
  error,
  onJoin,
}: {
  inviterName: string | null;
  joining: boolean;
  error: string | null;
  onJoin: (selectedCardIds: string[], displayName: string) => void;
}) {
  return (
    <div className="space-y-5 px-4 pb-24 pt-5">
      <header className="fz-bubble fz-bubble--pick p-5 sm:p-6">
        <p className="fz-seclabel">finz · 채팅방 초대</p>
        <h1 className="fz-display mt-2 text-2xl leading-tight text-[var(--fz-ink)] sm:text-3xl">
          {inviterName ? `${inviterName}님이 우정주 파티에 초대했어요.` : "우정주 파티에 초대됐어요."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fz-muted)]">
          로그인 없이 취향 카드 3개만 고르면 캐릭터가 만들어지고, 이 채팅방에 들어가 둘의 조합으로 우정주를 뽑을 수 있어.
        </p>
      </header>

      <section className="fz-card space-y-4 p-5">
        <FinzCharacterBuilder submitLabel="채팅방 들어가기" pending={joining} onSubmit={onJoin} />
        {error && <p className="fz-alert">{error}</p>}
      </section>
    </div>
  );
}
