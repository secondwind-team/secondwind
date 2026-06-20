"use client";

import { Sparkles } from "lucide-react";
import { splitByMention, type FinzChatMessage } from "@/lib/common/services/finz-chat";
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

// finz 봇 아바타(코랄 점) — 왼쪽 픽/요약/시스템성 봇 말풍선 앞에.
function FinzAvatar() {
  return (
    <span className="fz-avatar mt-0.5 h-8 w-8 shrink-0 text-base" aria-hidden>
      🤖
    </span>
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
          <p className="px-1 text-xs font-semibold text-[var(--fz-coral-ink)]">FINZ · 오늘의 우정주</p>
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
          <p className="px-1 text-xs font-semibold text-[var(--fz-amber-ink)]">FINZ · 파티 요약</p>
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
          <p className="px-1 text-xs font-semibold text-[var(--fz-coral-ink)]">FINZ · 차트</p>
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
          <p className="px-1 text-xs font-semibold text-[var(--fz-coral-ink)]">FINZ</p>
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
      </div>
    );
  }

  // text
  return (
    <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
      {!mine && <span className="px-1 text-xs text-[var(--fz-muted)]">{message.authorName}</span>}
      <div className={`fz-msg whitespace-pre-wrap break-words ${mine ? "fz-msg--me" : ""}`}>
        <MessageBody text={message.text} />
      </div>
    </div>
  );
}
