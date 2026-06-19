"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatHandle, type FinzAccountSummary, type FinzFriendsView } from "@/lib/common/services/finz-account";

// 새 대화 시트: 1:1(친구 1명) 또는 그룹(제목 + 친구 여럿). 친구가 없으면 안내.
export function FinzNewChatSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [friends, setFriends] = useState<FinzAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"1on1" | "group">("1on1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/finz/friends", { cache: "no-store" });
        const json = (await res.json()) as { status: string } & Partial<FinzFriendsView>;
        if (!cancelled && json.status === "ok") setFriends((json.friends ?? []).map((f) => f.account));
      } catch {
        // 무시
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (kind === "1on1") {
        next.clear();
        if (!prev.has(id)) next.add(id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function switchKind(next: "1on1" | "group") {
    setKind(next);
    setSelected(new Set());
    setError(null);
  }

  const canCreate = kind === "1on1" ? selected.size === 1 : true; // 그룹은 나만으로도 만들고 나중에 초대 가능

  async function create() {
    if (creating || !canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const body =
        kind === "1on1"
          ? { kind: "1on1", targetAccountId: [...selected][0] }
          : { kind: "group", title: title.trim(), friendIds: [...selected] };
      const res = await fetch("/api/finz/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { status: string; roomId?: string };
      if (json.status === "ok" && json.roomId) {
        onCreated(json.roomId);
      } else {
        setError("대화방을 만들지 못했어. 잠시 뒤 다시 시도해줘.");
      }
    } catch {
      setError("연결이 잠깐 끊겼어.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="새 대화">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-xl rounded-t-[var(--fz-r-lg)] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-5 shadow-[var(--fz-shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="fz-display text-xl text-[var(--fz-ink)]">새 대화 시작</h2>
          <button type="button" onClick={onClose} className="fz-iconbtn" aria-label="닫기">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* 종류 토글 */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => switchKind("1on1")}
            aria-pressed={kind === "1on1"}
            className={`fz-chip flex-1 ${kind === "1on1" ? "fz-chip--on" : ""}`}
          >
            1:1 대화
          </button>
          <button
            type="button"
            onClick={() => switchKind("group")}
            aria-pressed={kind === "group"}
            className={`fz-chip flex-1 ${kind === "group" ? "fz-chip--on" : ""}`}
          >
            그룹 대화
          </button>
        </div>

        {kind === "group" && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder="그룹 이름 (선택)"
            className="fz-input mb-3"
            aria-label="그룹 이름"
          />
        )}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fz-muted)]">
          {kind === "1on1" ? "대화 상대 고르기" : "초대할 친구 (나중에 더 초대 가능)"}
        </p>

        <div className="max-h-[40vh] overflow-y-auto rounded-[var(--fz-r)] border border-[var(--fz-line)]">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--fz-muted)]">친구를 불러오는 중…</p>
          ) : friends.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--fz-muted)]">
              먼저 친구 탭에서 핸들로 친구를 추가해줘.
            </p>
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

        {error && <p className="fz-alert mt-3">{error}</p>}

        <button type="button" onClick={() => void create()} disabled={creating || !canCreate} className="fz-btn mt-4 w-full">
          {creating ? "만드는 중…" : kind === "1on1" ? "대화 시작" : "그룹 만들기"}
        </button>
      </div>
    </div>
  );
}
