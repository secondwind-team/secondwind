"use client";

import { Sparkles } from "lucide-react";
import { splitByMention, type FinzChatMessage } from "@/lib/common/services/finz-chat";
import { formatKstTime } from "@/lib/common/services/finz-time";
import { FinzPartyPickResult } from "./finz-party-pick-result";
import { FinzPartySummaryCard } from "./finz-party-summary";
import { FinzChartBubble } from "./finz-chart-bubble";
import { STANCE_EMOJI } from "./finz-position-input";

// 메시지 본문 — @finz 같은 멘션 토큰만 .fz-mention 칩으로 강조(나머지는 그대로).
function MessageBody({ text }: { text: string }) {
  return (
    <>
      {splitByMention(text).map((seg, i) =>
        seg.isMention ? (
          <span key={i} className="fz-mention">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

// 메시지 옆 작은 시각(오전/오후 h:mm). 말풍선 바깥 아래 모서리에 붙는다(카카오톡식).
function MsgTime({ iso }: { iso: string }) {
  const t = formatKstTime(iso);
  if (!t) return null;
  return <time className="mb-0.5 shrink-0 text-[10px] leading-none text-[var(--fz-muted)]">{t}</time>;
}

// finz 봇 아바타(코랄 점) — 왼쪽 픽/요약/시스템성 봇 말풍선 앞에.
function FinzAvatar() {
  return (
    <span className="fz-avatar mt-0.5 h-8 w-8 shrink-0 text-base" aria-hidden>
      🤖
    </span>
  );
}

// finz 봇 메시지 헤더 — 라벨(좌) + 시각(우). 큰 카드(픽/요약/차트)는 시각을 여기에 둔다.
function FinzHeader({ label, iso, amber }: { label: string; iso: string; amber?: boolean }) {
  const t = formatKstTime(iso);
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <p className={`text-xs font-semibold ${amber ? "text-[var(--fz-amber-ink)]" : "text-[var(--fz-coral-ink)]"}`}>
        {label}
      </p>
      {t && <span className="shrink-0 text-[10px] leading-none text-[var(--fz-muted)]">{t}</span>}
    </div>
  );
}

// 한 메시지 렌더 — kind/role 로 분기. me 는 오른쪽 코랄, 상대는 왼쪽 흰색, 봇/시스템은 별도.
export function FinzChatMessageView({
  message,
  myMemberId,
  isLatestPick,
  onReroll,
  superseded,
  changed,
}: {
  message: FinzChatMessage;
  myMemberId: string | null;
  isLatestPick?: boolean;
  onReroll?: () => void;
  superseded?: boolean;
  changed?: boolean;
}) {
  if (message.kind === "system") {
    // 시스템 알림은 시각을 붙이지 않는다(카카오톡과 동일 — 가운데 회색 pill).
    return (
      <div className="my-1 flex justify-center">
        <span className="rounded-[var(--fz-r-full)] bg-[var(--fz-surface-2)] px-3 py-1 text-xs text-[var(--fz-muted)]">
          {message.text}
        </span>
      </div>
    );
  }

  if (message.kind === "pick") {
    return (
      <div className="flex items-start gap-2">
        <FinzAvatar />
        <div className="min-w-0 flex-1 space-y-2">
          <FinzHeader label="FINZ · 오늘의 우정주" iso={message.createdAt} />
          <FinzPartyPickResult pick={message.payload} />
          {isLatestPick && onReroll && (
            <button type="button" onClick={onReroll} className="fz-btn fz-btn--ghost text-xs">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              다른 우정주로 다시 뽑기
            </button>
          )}
        </div>
      </div>
    );
  }

  if (message.kind === "summary") {
    return (
      <div className="flex items-start gap-2">
        <FinzAvatar />
        <div className="min-w-0 flex-1 space-y-1">
          <FinzHeader label="FINZ · 파티 요약" iso={message.createdAt} amber />
          <FinzPartySummaryCard summary={message.payload} />
        </div>
      </div>
    );
  }

  if (message.kind === "chart") {
    return (
      <div className="flex items-start gap-2">
        <FinzAvatar />
        <div className="min-w-0 flex-1 space-y-1">
          <FinzHeader label="FINZ · 차트" iso={message.createdAt} />
          <FinzChartBubble payload={message.payload} />
        </div>
      </div>
    );
  }

  // finz 의 자유 텍스트 답변(@finz 질문에 대한 응답) — 봇 말풍선으로.
  if (message.kind === "text" && message.role === "finz") {
    return (
      <div className="flex items-start gap-2">
        <FinzAvatar />
        <div className="min-w-0 flex-1 space-y-1">
          <FinzHeader label="FINZ" iso={message.createdAt} />
          <div className="fz-bubble max-w-full whitespace-pre-wrap break-words p-3.5 text-sm leading-relaxed text-[var(--fz-ink)]">
            <MessageBody text={message.text} />
          </div>
        </div>
      </div>
    );
  }

  const mine = message.authorId === myMemberId;

  if (message.kind === "position") {
    return (
      <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
        {!mine && <span className="px-1 text-xs text-[var(--fz-muted)]">{message.authorName}</span>}
        <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
          <div className={`fz-msg ${mine ? "fz-msg--me" : ""} ${superseded ? "opacity-55" : ""}`}>
            <span className="font-semibold">
              {STANCE_EMOJI[message.payload.stance]} {message.payload.stance}
            </span>
            {message.payload.note && (
              <span className={mine ? "opacity-90" : "text-[var(--fz-muted)]"}> · {message.payload.note}</span>
            )}
            {changed && (
              <span className="ml-1.5 rounded-[var(--fz-r-full)] bg-[var(--fz-amber-tint)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fz-amber-ink)]">
                바뀐 입장
              </span>
            )}
          </div>
          <MsgTime iso={message.createdAt} />
        </div>
      </div>
    );
  }

  // text (멤버)
  return (
    <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
      {!mine && <span className="px-1 text-xs text-[var(--fz-muted)]">{message.authorName}</span>}
      <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <div className={`fz-msg whitespace-pre-wrap break-words ${mine ? "fz-msg--me" : ""}`}>
          <MessageBody text={message.text} />
        </div>
        <MsgTime iso={message.createdAt} />
      </div>
    </div>
  );
}
