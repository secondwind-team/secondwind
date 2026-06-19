"use client";

import { Check, Copy, Link2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatHandle, type FinzAccountSummary, type FinzFriendsView } from "@/lib/common/services/finz-account";

// 대화방 초대 시트: (1) 링크 복사로 누구나 들어오게, (2) 친구를 골라 바로 추가.
export function FinzInviteSheet({
  shareUrl,
  existingMemberIds,
  onInvite,
  onClose,
}: {
  shareUrl: string;
  existingMemberIds: string[];
  onInvite: (accountIds: string[]) => void;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<FinzAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/finz/friends", { cache: "no-store" });
        const json = (await res.json()) as { status: string } & Partial<FinzFriendsView>;
        if (!cancelled && json.status === "ok") {
          const inRoom = new Set(existingMemberIds);
          setFriends((json.friends ?? []).map((f) => f.account).filter((a) => !inRoom.has(a.accountId)));
        }
      } catch {
        // 무시
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingMemberIds]);

  function copyLink() {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function invite() {
    if (selected.size === 0 || inviting) return;
    setInviting(true);
    onInvite([...selected]);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="초대">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-xl rounded-t-[var(--fz-r-lg)] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-5 shadow-[var(--fz-shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="fz-display text-xl text-[var(--fz-ink)]">초대하기</h2>
          <button type="button" onClick={onClose} className="fz-iconbtn" aria-label="닫기">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* 링크 복사 — 불특정 다수도 링크로 들어올 수 있어 */}
        <button type="button" onClick={copyLink} className="fz-btn fz-btn--ghost mb-4 w-full justify-start">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          {copied ? "링크가 복사됐어!" : "초대 링크 복사"}
          {!copied && <Copy className="ml-auto h-4 w-4 opacity-60" aria-hidden />}
        </button>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fz-muted)]">친구 바로 추가</p>
        <div className="max-h-[36vh] overflow-y-auto rounded-[var(--fz-r)] border border-[var(--fz-line)]">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--fz-muted)]">친구를 불러오는 중…</p>
          ) : friends.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--fz-muted)]">추가할 친구가 없어. 링크로 초대해봐.</p>
          ) : (
            friends.map((f) => {
              const on = selected.has(f.accountId);
              return (
                <button
                  key={f.accountId}
                  type="button"
                  onClick={() => toggle(f.accountId)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 border-b border-[var(--fz-line)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--fz-surface-2)]"
                >
                  <span className="fz-avatar h-9 w-9 shrink-0 text-sm font-bold" aria-hidden>
                    {f.displayName.trim().charAt(0) || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--fz-ink)]">{f.displayName}</span>
                    <span className="block truncate text-xs text-[var(--fz-muted)]">{formatHandle(f.handle)}</span>
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      on ? "border-transparent bg-[var(--fz-coral)] text-white" : "border-[var(--fz-line)] text-transparent"
                    }`}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <button type="button" onClick={invite} disabled={selected.size === 0 || inviting} className="fz-btn mt-4 w-full">
          {inviting ? "초대 중…" : selected.size > 0 ? `${selected.size}명 초대하기` : "친구를 골라줘"}
        </button>
      </div>
    </div>
  );
}
