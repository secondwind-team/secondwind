"use client";

import { Sparkles } from "lucide-react";
import { useRef, type ReactNode } from "react";
import {
  FINZ_REACTION_EMOJIS,
  splitByMentionTokens,
  type FinzChatMessage,
} from "@/lib/common/services/finz-chat";
import { formatKstTime } from "@/lib/common/services/finz-time";
import { FinzRichText } from "./finz-rich-text";
import { FinzPartyPickResult } from "./finz-party-pick-result";
import { FinzPartySummaryCard } from "./finz-party-summary";
import { FinzChartBubble } from "./finz-chart-bubble";
import { FinzPortfolioCard } from "./finz-portfolio-card";
import { STANCE_EMOJI } from "./finz-position-input";

// 메시지 본문 — @finz·@멤버 멘션 토큰만 .fz-mention 칩으로 강조(나머지는 그대로).
function MessageBody({ text, mentionNames }: { text: string; mentionNames: string[] }) {
  return (
    <>
      {splitByMentionTokens(text, mentionNames).map((seg, i) =>
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

function clearSelection() {
  if (typeof window === "undefined") return;
  window.getSelection()?.removeAllRanges();
}

function ActionableMessage({
  children,
  onOpenActions,
}: {
  children: ReactNode;
  onOpenActions?: (point: { x: number; y: number }) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function isInteractive(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest("button,a,input,textarea,select"));
  }

  if (!onOpenActions) return <>{children}</>;

  return (
    <div
      onContextMenu={(e) => {
        if (isInteractive(e.target)) return;
        e.preventDefault();
        clearSelection();
        onOpenActions({ x: e.clientX, y: e.clientY });
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" || isInteractive(e.target)) return;
        startRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (e.cancelable) e.preventDefault();
          clearSelection();
          onOpenActions({ x: e.clientX, y: e.clientY });
        }, 520);
      }}
      onPointerMove={(e) => {
        const start = startRef.current;
        if (!start) return;
        if (Math.abs(e.clientX - start.x) > 12 || Math.abs(e.clientY - start.y) > 12) clearTimer();
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
    >
      {children}
    </div>
  );
}

function ReplyQuote({ message, onJump }: { message: FinzChatMessage; onJump?: (messageId: string) => void }) {
  if (!message.replyTo) return null;
  const inner = (
    <>
      <span>{message.replyTo.authorName}</span>
      <p>{message.replyTo.snippet}</p>
    </>
  );
  if (onJump) {
    return (
      <button
        type="button"
        className="fz-reply-quote fz-reply-quote--button"
        onClick={() => onJump(message.replyTo!.id)}
        aria-label={`${message.replyTo.authorName}님의 원문 메시지로 이동`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="fz-reply-quote">
      {inner}
    </div>
  );
}

function EditedLabel({ message }: { message: FinzChatMessage }) {
  if (!message.editedAt || message.deletedAt) return null;
  return <span className="ml-1 text-[10px] font-medium opacity-70">수정됨</span>;
}

function ReactionBar({ message, mine }: { message: FinzChatMessage; mine: boolean }) {
  const reactions = message.reactions ?? {};
  const counts = FINZ_REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: Object.values(reactions).filter((x) => x === emoji).length,
  })).filter((x) => x.count > 0);
  if (counts.length === 0 || message.deletedAt) return null;
  return (
    <div className={`fz-reactions ${mine ? "fz-reactions--me" : ""}`} aria-label="메시지 반응">
      {counts.map((x) => (
        <span key={x.emoji} className="fz-reaction-chip">
          <span aria-hidden>{x.emoji}</span>
          <span>{x.count}</span>
        </span>
      ))}
    </div>
  );
}

function DeletedText() {
  return <span className="italic text-[var(--fz-muted)]">삭제된 메시지입니다</span>;
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
  mentionNames = [],
  isLatestPick,
  onReroll,
  superseded,
  changed,
  onOpenActions,
  onReplyQuoteJump,
}: {
  message: FinzChatMessage;
  myMemberId: string | null;
  mentionNames?: string[];
  isLatestPick?: boolean;
  onReroll?: () => void;
  superseded?: boolean;
  changed?: boolean;
  onOpenActions?: (point: { x: number; y: number }) => void;
  onReplyQuoteJump?: (messageId: string) => void;
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
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className="flex items-start gap-2">
          <FinzAvatar />
          <div className="min-w-0 flex-1 space-y-2">
            <FinzHeader label="FINZ · 오늘의 우정주" iso={message.createdAt} />
            <FinzPartyPickResult pick={message.payload} />
            <ReactionBar message={message} mine={false} />
            {isLatestPick && onReroll && (
              <button type="button" onClick={onReroll} className="fz-btn fz-btn--ghost text-xs">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                다른 우정주로 다시 뽑기
              </button>
            )}
          </div>
        </div>
      </ActionableMessage>
    );
  }

  if (message.kind === "summary") {
    return (
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className="flex items-start gap-2">
          <FinzAvatar />
          <div className="min-w-0 flex-1 space-y-1">
            <FinzHeader label="FINZ · 파티 요약" iso={message.createdAt} amber />
            <FinzPartySummaryCard summary={message.payload} />
            <ReactionBar message={message} mine={false} />
          </div>
        </div>
      </ActionableMessage>
    );
  }

  if (message.kind === "chart") {
    return (
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className="flex items-start gap-2">
          <FinzAvatar />
          <div className="min-w-0 flex-1 space-y-1">
            <FinzHeader label="FINZ · 차트" iso={message.createdAt} />
            <FinzChartBubble payload={message.payload} />
            <ReactionBar message={message} mine={false} />
          </div>
        </div>
      </ActionableMessage>
    );
  }

  if (message.kind === "portfolio") {
    return (
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className="flex items-start gap-2">
          <FinzAvatar />
          <div className="min-w-0 flex-1 space-y-1">
            <FinzHeader label={message.payload.view === "sector" ? "FINZ · 섹터 분석" : "FINZ · 포트폴리오"} iso={message.createdAt} />
            <FinzPortfolioCard payload={message.payload} />
            <ReactionBar message={message} mine={false} />
          </div>
        </div>
      </ActionableMessage>
    );
  }

  // finz 의 자유 텍스트 답변(@finz 질문에 대한 응답) — 봇 말풍선으로.
  if (message.kind === "text" && message.role === "finz") {
    return (
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className="flex items-start gap-2">
          <FinzAvatar />
          <div className="min-w-0 flex-1 space-y-1">
            <FinzHeader label="FINZ" iso={message.createdAt} />
            <div className="fz-bubble max-w-full break-words p-3.5 text-sm leading-relaxed text-[var(--fz-ink)]">
              <FinzRichText text={message.text} mentionNames={mentionNames} />
            </div>
            <ReactionBar message={message} mine={false} />
          </div>
        </div>
      </ActionableMessage>
    );
  }

  const mine = message.authorId === myMemberId;

  if (message.kind === "position") {
    return (
      <ActionableMessage onOpenActions={onOpenActions}>
        <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
          {!mine && <span className="px-1 text-xs text-[var(--fz-muted)]">{message.authorName}</span>}
          <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
            <div className={`fz-msg ${mine ? "fz-msg--me" : ""} ${superseded ? "opacity-55" : ""}`}>
              {message.deletedAt ? (
                <DeletedText />
              ) : (
                <>
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
                </>
              )}
            </div>
            <MsgTime iso={message.createdAt} />
          </div>
          <ReactionBar message={message} mine={mine} />
        </div>
      </ActionableMessage>
    );
  }

  // text (멤버)
  return (
    <ActionableMessage onOpenActions={onOpenActions}>
      <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
        {!mine && <span className="px-1 text-xs text-[var(--fz-muted)]">{message.authorName}</span>}
        <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
          <div className={`fz-msg whitespace-pre-wrap break-words ${mine ? "fz-msg--me" : ""}`}>
            <ReplyQuote message={message} onJump={onReplyQuoteJump} />
            {message.deletedAt ? (
              <DeletedText />
            ) : (
              <>
                <MessageBody text={message.text} mentionNames={mentionNames} />
                <EditedLabel message={message} />
              </>
            )}
          </div>
          <MsgTime iso={message.createdAt} />
        </div>
        <ReactionBar message={message} mine={mine} />
      </div>
    </ActionableMessage>
  );
}
