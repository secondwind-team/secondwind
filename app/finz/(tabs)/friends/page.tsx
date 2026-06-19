"use client";

import { AtSign, Check, MessageCircle, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  FINZ_HANDLE_MAX,
  formatHandle,
  type FinzAccountSummary,
  type FinzFriendEntry,
  type FinzFriendsView,
} from "@/lib/common/services/finz-account";
import { summonFinzCharacter } from "@/lib/common/services/finz";
import { useFinzAccount } from "@/app/finz/_components/finz-account-context";

// 친구 탭: 핸들로 친구 추가, 받은/보낸 요청, 친구 목록(탭하면 1:1 대화 시작).
export default function FinzFriendsPage() {
  const me = useFinzAccount();
  const router = useRouter();
  const [view, setView] = useState<FinzFriendsView>({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [handleInput, setHandleInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finz/friends", { cache: "no-store" });
      const json = (await res.json()) as { status: string } & Partial<FinzFriendsView>;
      if (json.status === "ok") {
        setView({ friends: json.friends ?? [], incoming: json.incoming ?? [], outgoing: json.outgoing ?? [] });
      }
    } catch {
      // 무시 — 다음 로드에서 복구
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFriend() {
    const handle = handleInput.trim();
    if (!handle || adding) return;
    setAdding(true);
    setNotice(null);
    try {
      const res = await fetch("/api/finz/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const json = (await res.json()) as { status: string; state?: string };
      if (json.status === "ok") {
        setNotice({ tone: "ok", text: json.state === "accepted" ? "바로 친구가 됐어! 🎉" : "친구 요청을 보냈어." });
        setHandleInput("");
        await load();
      } else if (json.status === "not-found") {
        setNotice({ tone: "err", text: "그 핸들을 쓰는 사람을 못 찾았어." });
      } else if (json.status === "self") {
        setNotice({ tone: "err", text: "그건 네 핸들이야 🙂" });
      } else if (json.status === "already-friends") {
        setNotice({ tone: "err", text: "이미 친구야!" });
      } else if (json.status === "already-requested") {
        setNotice({ tone: "err", text: "이미 요청을 보냈어. 수락을 기다려보자." });
      } else {
        setNotice({ tone: "err", text: "추가하지 못했어. 잠시 뒤 다시 시도해줘." });
      }
    } catch {
      setNotice({ tone: "err", text: "연결이 잠깐 끊겼어." });
    } finally {
      setAdding(false);
    }
  }

  async function respond(accountId: string, accept: boolean) {
    try {
      await fetch("/api/finz/friends", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, accept }),
      });
      await load();
    } catch {
      // 무시
    }
  }

  async function startChat(friend: FinzAccountSummary) {
    if (startingChatWith) return;
    setStartingChatWith(friend.accountId);
    try {
      const res = await fetch("/api/finz/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "1on1", targetAccountId: friend.accountId }),
      });
      const json = (await res.json()) as { status: string; roomId?: string };
      if (json.status === "ok" && json.roomId) {
        router.push(`/finz/party/${json.roomId}`);
      } else {
        setNotice({ tone: "err", text: "대화방을 열지 못했어." });
        setStartingChatWith(null);
      }
    } catch {
      setNotice({ tone: "err", text: "연결이 잠깐 끊겼어." });
      setStartingChatWith(null);
    }
  }

  return (
    <div className="pb-6">
      {/* 친구 추가 */}
      <section className="border-b border-[var(--fz-line)] bg-[var(--fz-surface-2)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--fz-ink)]">핸들로 친구 추가</p>
        <p className="mt-1 text-xs text-[var(--fz-muted)]">
          내 핸들은 <span className="font-semibold text-[var(--fz-coral-ink)]">{formatHandle(me.handle)}</span> · 친구에게 알려줘.
        </p>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fz-muted)]" aria-hidden />
            <input
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addFriend()}
              maxLength={FINZ_HANDLE_MAX + 2}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="친구 핸들"
              className="fz-input pl-9"
              aria-label="친구 핸들"
            />
          </div>
          <button type="button" onClick={() => void addFriend()} disabled={adding || !handleInput.trim()} className="fz-btn shrink-0">
            <UserPlus className="h-4 w-4" aria-hidden />
            추가
          </button>
        </div>
        {notice && (
          <p className={`mt-2 text-xs font-medium ${notice.tone === "ok" ? "text-[var(--fz-amber-ink)]" : "text-[var(--fz-coral-ink)]"}`}>
            {notice.text}
          </p>
        )}
      </section>

      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--fz-muted)]">불러오는 중…</p>
      ) : (
        <>
          {/* 받은 요청 */}
          {view.incoming.length > 0 && (
            <section>
              <SectionLabel>받은 요청 <span className="fz-badge ml-1">{view.incoming.length}</span></SectionLabel>
              {view.incoming.map((entry) => (
                <RequestRow
                  key={entry.account.accountId}
                  entry={entry}
                  onAccept={() => void respond(entry.account.accountId, true)}
                  onDecline={() => void respond(entry.account.accountId, false)}
                />
              ))}
            </section>
          )}

          {/* 친구 목록 */}
          <section>
            <SectionLabel>친구 {view.friends.length > 0 && <span className="text-[var(--fz-muted)]">· {view.friends.length}</span>}</SectionLabel>
            {view.friends.length === 0 ? (
              <div className="fz-empty">
                <span className="fz-empty__emoji" aria-hidden>👋</span>
                <p className="text-sm">아직 친구가 없어. 위에서 핸들로 친구를 추가해봐.</p>
              </div>
            ) : (
              view.friends.map((entry) => (
                <FriendRow
                  key={entry.account.accountId}
                  account={entry.account}
                  starting={startingChatWith === entry.account.accountId}
                  onChat={() => void startChat(entry.account)}
                />
              ))
            )}
          </section>

          {/* 보낸 요청 */}
          {view.outgoing.length > 0 && (
            <section className="mt-2">
              <SectionLabel>보낸 요청</SectionLabel>
              {view.outgoing.map((entry) => (
                <div key={entry.account.accountId} className="fz-list-row">
                  <Avatar account={entry.account} />
                  <div className="fz-list-row__body">
                    <div className="fz-list-row__title">{entry.account.displayName}</div>
                    <div className="fz-list-row__sub">{formatHandle(entry.account.handle)} · 수락 대기 중</div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-[var(--fz-muted)]">
      {children}
    </h2>
  );
}

function Avatar({ account }: { account: FinzAccountSummary }) {
  const initial = account.displayName.trim().charAt(0) || "?";
  return (
    <span className="fz-avatar h-11 w-11 shrink-0 text-base font-bold" aria-hidden>
      {initial}
    </span>
  );
}

function characterLabel(account: FinzAccountSummary): string {
  return summonFinzCharacter(account.selectedCardIds)?.className ?? "투자 캐릭터";
}

function FriendRow({ account, starting, onChat }: { account: FinzAccountSummary; starting: boolean; onChat: () => void }) {
  return (
    <div className="fz-list-row">
      <Avatar account={account} />
      <div className="fz-list-row__body">
        <div className="fz-list-row__title">{account.displayName}</div>
        <div className="fz-list-row__sub">
          {formatHandle(account.handle)} · {characterLabel(account)}
        </div>
      </div>
      <button type="button" onClick={onChat} disabled={starting} className="fz-iconbtn shrink-0" aria-label={`${account.displayName}님과 대화`}>
        <MessageCircle className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function RequestRow({ entry, onAccept, onDecline }: { entry: FinzFriendEntry; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="fz-list-row">
      <Avatar account={entry.account} />
      <div className="fz-list-row__body">
        <div className="fz-list-row__title">{entry.account.displayName}</div>
        <div className="fz-list-row__sub">{formatHandle(entry.account.handle)} 님이 친구 요청</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onAccept} className="fz-iconbtn" aria-label="수락">
          <Check className="h-4 w-4 text-[var(--fz-coral-ink)]" aria-hidden />
        </button>
        <button type="button" onClick={onDecline} className="fz-iconbtn" aria-label="거절">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
