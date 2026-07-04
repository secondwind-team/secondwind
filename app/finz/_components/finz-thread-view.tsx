"use client";

import { Sparkles, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { selectThreadMessages, splitByMentionTokens, type FinzChatMessage } from "@/lib/common/services/finz-chat";
import { FinzChatMessageView } from "./finz-chat-message-view";
import type { PendingText } from "./finz-chat-timeline";

// 슬랙식 스레드 전용 화면(스레드 모드에서 답글 어포던스를 탭하면 열림). 방 위에 뜨는 전체화면 오버레이 —
// 타임라인을 언마운트하지 않아 폴링/스크롤이 유지되고, 같은 messages 에서 selectThreadMessages 로 이 스레드만
// 뽑아 라이브로 그린다. 답글은 항상 root 에 대한 답장(replyTo=rootId)으로 보내 2단계를 유지한다.
export function FinzThreadView({
  rootId,
  messages,
  pending,
  myMemberId,
  groupId,
  mentionNames,
  aiBusy,
  viewportH,
  onClose,
  onSendReply,
  onRetryPending,
}: {
  rootId: string;
  messages: FinzChatMessage[];
  pending: PendingText[]; // 이 스레드 답글 pending(부모가 parentId 로 필터)
  myMemberId: string | null;
  groupId: string; // 첨부 게이트 프록시 URL 구성용
  mentionNames: string[];
  aiBusy: boolean;
  viewportH: number | null;
  onClose: () => void;
  onSendReply: (text: string, rootId: string) => void;
  onRetryPending: (tempId: string) => void;
}) {
  const thread = selectThreadMessages(messages, rootId); // [root, ...답글]
  const root = thread[0];
  const replies = thread.slice(1);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 열릴 때 · 새 답글/답변/전송 중일 때 바닥으로.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [replies.length, pending.length, aiBusy]);

  // root 가 사라지면(삭제·창 밖) 스레드를 닫는다.
  useEffect(() => {
    if (!root) onClose();
  }, [root, onClose]);
  if (!root) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex min-h-0 flex-col bg-[var(--fz-bg)]"
      style={viewportH ? { height: `${viewportH}px` } : undefined}
      role="dialog"
      aria-label="스레드"
    >
      <div className="flex flex-none items-center gap-2 border-b border-[var(--fz-line)] px-3 py-2.5">
        <button type="button" onClick={onClose} aria-label="스레드 닫기" className="fz-iconbtn h-9 w-9 shrink-0">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--fz-ink)]">스레드</p>
          <p className="truncate text-xs text-[var(--fz-muted)]">답글 {replies.length}개</p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {/* 원글 */}
        <FinzChatMessageView message={root} myMemberId={myMemberId} groupId={groupId} mentionNames={mentionNames} />
        <div className="flex items-center gap-2 py-1">
          <div className="h-px flex-1 bg-[var(--fz-line)]" />
          <span className="text-[11px] font-medium text-[var(--fz-muted)]">답글 {replies.length}개</span>
          <div className="h-px flex-1 bg-[var(--fz-line)]" />
        </div>
        {/* 답글들 */}
        {replies.map((m) => (
          <FinzChatMessageView key={m.id} message={m} myMemberId={myMemberId} groupId={groupId} mentionNames={mentionNames} />
        ))}
        {/* 내 답글 pending(낙관적) */}
        {pending.map((p) => (
          <div key={p.tempId} className="flex flex-col items-end gap-0.5">
            <div className="fz-msg fz-msg--me whitespace-pre-wrap break-words opacity-70">{p.text}</div>
            {p.status === "failed" ? (
              <button
                type="button"
                onClick={() => onRetryPending(p.tempId)}
                className="px-1 text-[11px] font-medium text-[var(--fz-error)]"
              >
                전송 실패 · 다시 시도
              </button>
            ) : (
              <span className="px-1 text-[11px] text-[var(--fz-muted)]">보내는 중…</span>
            )}
          </div>
        ))}
        {/* finz 응답 중 인디케이터 */}
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
      </div>

      <ThreadReplyComposer mentionNames={mentionNames} onSend={(text) => onSendReply(text, rootId)} />
    </div>
  );
}

// 스레드 전용 답글 입력창 — 메인 컴포저의 멘션 하이라이트 오버레이(IME 안전 투명 textarea) 패턴을 재사용.
// 파티 액션(우정주/입장/요약)은 없고, 텍스트 답글 + '@finz' 빠른 삽입만.
function ThreadReplyComposer({ mentionNames, onSend }: { mentionNames: string[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  function syncScroll() {
    const ta = taRef.current;
    const bd = backdropRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  function insertFinz() {
    setText((t) => (/^@\s*finz/i.test(t) ? t : t ? `@finz ${t}` : "@finz "));
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    });
  }

  return (
    <div
      className="flex-none border-t border-[var(--fz-line)] bg-[var(--fz-bg)] px-4 pt-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-end gap-2 pb-1">
        <button
          type="button"
          onClick={insertFinz}
          aria-label="FINZ에게 물어보기"
          className="fz-btn fz-btn--ghost h-11 w-11 shrink-0"
          style={{ padding: 0 }}
        >
          <Sparkles className="h-5 w-5 shrink-0 text-[var(--fz-coral)]" aria-hidden />
        </button>

        <div className="relative flex-1">
          <div
            ref={backdropRef}
            aria-hidden
            className="fz-input pointer-events-none absolute inset-0 max-h-28 overflow-hidden whitespace-pre-wrap break-words py-2.5 text-[var(--fz-ink)]"
            style={{ borderColor: "transparent" }}
          >
            {splitByMentionTokens(text, mentionNames).map((seg, i) =>
              seg.isMention ? (
                <span key={i} className="fz-mention-live">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
            {text.endsWith("\n") ? " " : ""}
          </div>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="답글 달기 · @finz 로 질문"
            className="fz-input relative max-h-28 min-h-11 w-full resize-none py-2.5"
            style={{ background: "transparent", color: "transparent", caretColor: "var(--fz-ink)" }}
          />
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          aria-label="답글 보내기"
          className="fz-btn h-11 w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ padding: 0 }}
        >
          <Send className="h-6 w-6 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}
