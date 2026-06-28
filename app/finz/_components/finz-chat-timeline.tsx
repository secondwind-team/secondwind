"use client";

import { ArrowDown } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FinzChatMessage, FinzNudge } from "@/lib/common/services/finz-chat";
import { selectLatestPick } from "@/lib/common/services/finz-chat";
import { formatKstDate, kstDayKey } from "@/lib/common/services/finz-time";
import { FinzChatMessageView } from "./finz-chat-message-view";
import { FinzNudgeBubble } from "./finz-nudge-bubble";

export type PendingText = { tempId: string; text: string; status: "sending" | "failed" };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// 카카오톡식 날짜 구분선 — 하루가 바뀌면 한 번 가운데 pill 로 "yyyy년 M월 D일 (요일)".
function DateDivider({ iso }: { iso: string }) {
  const label = formatKstDate(iso);
  if (!label) return null;
  return (
    <div className="my-2 flex justify-center">
      <span className="rounded-[var(--fz-r-full)] bg-[var(--fz-surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--fz-muted)]">
        {label}
      </span>
    </div>
  );
}

// 메시지 타임라인 — flex-1 스크롤 영역. 내 행동엔 항상 바닥으로, 상대/봇 메시지엔 바닥 근처일 때만
// 자동 스크롤(아니면 '새 메시지' 칩). aria-live 로 스크린리더에 알림.
export function FinzChatTimeline({
  messages,
  pending,
  myMemberId,
  mentionNames,
  nudge,
  aiBusy,
  stickSignal,
  onReroll,
  onNudgeCta,
  onRetryPending,
}: {
  messages: FinzChatMessage[];
  pending: PendingText[];
  myMemberId: string | null;
  mentionNames: string[];
  nudge: FinzNudge | null;
  aiBusy: boolean;
  stickSignal: number;
  onReroll: () => void;
  onNudgeCta: (cta: FinzNudge["cta"]) => void;
  onRetryPending: (tempId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const [showChip, setShowChip] = useState(false);

  const latestPick = useMemo(() => selectLatestPick(messages), [messages]);

  // 포지션 superseded(같은 작성자의 더 최신 입장이 있으면 흐리게) / changed(2개+면 최신에 '바뀐 입장').
  const { supersededIds, changedIds } = useMemo(() => {
    const byAuthorLatestSeq = new Map<string, number>();
    const byAuthorCount = new Map<string, number>();
    for (const m of messages) {
      if (m.kind !== "position") continue;
      byAuthorCount.set(m.authorId, (byAuthorCount.get(m.authorId) ?? 0) + 1);
      const cur = byAuthorLatestSeq.get(m.authorId) ?? -1;
      if (m.seq > cur) byAuthorLatestSeq.set(m.authorId, m.seq);
    }
    const superseded = new Set<string>();
    const changed = new Set<string>();
    for (const m of messages) {
      if (m.kind !== "position") continue;
      const latest = byAuthorLatestSeq.get(m.authorId);
      if (m.seq !== latest) superseded.add(m.id);
      else if ((byAuthorCount.get(m.authorId) ?? 0) >= 2) changed.add(m.id);
    }
    return { supersededIds: superseded, changedIds: changed };
  }, [messages]);

  function scrollToBottom(smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
    setShowChip(false);
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottomRef.current) setShowChip(false);
  }

  // 첫 렌더에 바닥으로(레이아웃 직후).
  useLayoutEffect(() => {
    scrollToBottom(false);
    prevCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 내 행동(stickSignal 증가) → 무조건 바닥.
  useEffect(() => {
    if (stickSignal > 0) scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickSignal]);

  // 콘텐츠 변화 → 바닥 근처면 따라가고, 아니면 칩. nudge 참조 변화로는 스크롤하지 않는다(매 폴링 흔들림 방지).
  useEffect(() => {
    const grew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!grew && !aiBusy) return; // 새 메시지/타이핑일 때만 자동 추적
    if (nearBottomRef.current) scrollToBottom(true);
    else if (grew) setShowChip(true);
  }, [messages.length, pending.length, aiBusy]);

  // 스크린리더용 간결 알림 — 큰 픽/요약 카드를 통째로 읽지 않게 한 줄 큐만.
  const [liveMsg, setLiveMsg] = useState("");
  const lastAnnouncedRef = useRef(-1);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.seq <= lastAnnouncedRef.current) return;
    lastAnnouncedRef.current = last.seq;
    if (last.authorId === myMemberId) return; // 내 메시지는 알리지 않음
    if (last.kind === "pick") setLiveMsg("FINZ가 우정주를 뽑았어요.");
    else if (last.kind === "summary") setLiveMsg("파티 요약이 도착했어요.");
    else if (last.kind === "chart") setLiveMsg("FINZ가 차트를 보여줬어요.");
    else if (last.kind === "portfolio") setLiveMsg("FINZ가 포트폴리오를 정리했어요.");
    else if (last.kind === "system") setLiveMsg(last.text);
    else setLiveMsg(`${last.authorName}님이 메시지를 보냈어요.`);
  }, [messages, myMemberId]);

  // 보내는 중인 메시지(아직 createdAt 없음)가 마지막 실제 메시지와 다른 날(자정 넘김)이면 그 앞에도 구분선.
  const nowIso = new Date().toISOString();
  const lastReal = messages[messages.length - 1];
  const pendingNeedsDivider =
    pending.length > 0 && (!lastReal || kstDayKey(lastReal.createdAt) !== kstDayKey(nowIso));

  return (
    <div className="relative min-h-0 flex-1">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMsg}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          // 직전 메시지와 KST 날짜가 다르면(또는 첫 메시지면) 그 앞에 날짜 구분선을 한 번 넣는다.
          const prev = messages[i - 1];
          const showDate = !prev || kstDayKey(prev.createdAt) !== kstDayKey(m.createdAt);
          return (
            <Fragment key={m.id}>
              {showDate && <DateDivider iso={m.createdAt} />}
              <FinzChatMessageView
                message={m}
                myMemberId={myMemberId}
                mentionNames={mentionNames}
                isLatestPick={m.kind === "pick" && latestPick?.id === m.id}
                onReroll={onReroll}
                superseded={m.kind === "position" && supersededIds.has(m.id)}
                changed={m.kind === "position" && changedIds.has(m.id)}
              />
            </Fragment>
          );
        })}

        {pendingNeedsDivider && <DateDivider iso={nowIso} />}
        {pending.map((p) => (
          <div key={p.tempId} className="flex flex-col items-end gap-0.5">
            <div className="fz-msg fz-msg--me whitespace-pre-wrap break-words opacity-70">{p.text}</div>
            {p.status === "failed" ? (
              <button type="button" onClick={() => onRetryPending(p.tempId)} className="px-1 text-[11px] font-medium text-[var(--fz-error)]">
                전송 실패 · 다시 시도
              </button>
            ) : (
              <span className="px-1 text-[11px] text-[var(--fz-muted)]">보내는 중…</span>
            )}
          </div>
        ))}

        {aiBusy && (
          <div className="flex items-start gap-2" aria-hidden>
            <span className="fz-avatar mt-0.5 h-8 w-8 shrink-0 text-base">🤖</span>
            <div className="fz-msg">
              <span className="fz-typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}

        {nudge && <FinzNudgeBubble nudge={nudge} onCta={onNudgeCta} />}
      </div>

      {showChip && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fz-btn absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs shadow-[var(--fz-shadow)]"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />새 메시지
        </button>
      )}
    </div>
  );
}
