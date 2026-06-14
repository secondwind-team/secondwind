"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import {
  computeNextNudge,
  selectLatestPick,
  selectLatestPositionsByMember,
  type FinzChatMemberLite,
  type FinzChatMessage,
  type FinzNudge,
  type LatestPosition,
} from "@/lib/common/services/finz-chat";
import {
  getOrCreateMemberId,
  getRememberedMemberId,
  rememberPartyMembership,
} from "@/lib/common/finz-party-id";
import { FinzChatComposer } from "./finz-chat-composer";
import { FinzChatHeader } from "./finz-chat-header";
import { FinzChatTimeline, type PendingText } from "./finz-chat-timeline";
import { FinzJoinView } from "./finz-join-view";
import { FinzRoomFullNotice } from "./finz-room-full-notice";

const MAX_MEMBERS = 2;

// 멤버 집합이 실질적으로 같은지(id + 표시이름) — 폴링 리렌더 억제용.
function sameMembers(a: FinzChatMemberLite[], b: FinzChatMemberLite[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => m.memberId === b[i]?.memberId && m.displayName === b[i]?.displayName);
}

export function FinzPartyRoom({
  groupId,
  initialMembers,
  initialMessages,
  initialCursor,
  initialFull,
}: {
  groupId: string;
  initialMembers: FinzChatMemberLite[];
  initialMessages: FinzChatMessage[];
  initialCursor: number;
  initialFull: boolean;
}) {
  const [members, setMembers] = useState<FinzChatMemberLite[]>(initialMembers);
  const [full, setFull] = useState(initialFull);
  const [messages, setMessages] = useState<FinzChatMessage[]>(initialMessages);
  const cursorRef = useRef(initialCursor);

  const [idResolved, setIdResolved] = useState(false);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  const [pending, setPending] = useState<PendingText[]>([]);
  const [pickBusy, setPickBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [positionSubmitting, setPositionSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [stanceMode, setStanceMode] = useState(false);
  const [stickSignal, setStickSignal] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewportH, setViewportH] = useState<number | null>(null);

  const bumpStick = useCallback(() => setStickSignal((s) => s + 1), []);

  useEffect(() => {
    setMyMemberId(getRememberedMemberId(groupId));
    setIdResolved(true);
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, [groupId]);

  const isMember = myMemberId != null && members.some((m) => m.memberId === myMemberId);

  // 모바일 키보드 대응: visualViewport 높이에 채팅방을 맞춰 하단 입력바가 키보드 뒤로 숨지 않게.
  // visualViewport 가 없으면(데스크톱) flex 로 채운다(viewportH=null).
  useEffect(() => {
    if (!isMember || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    function sync() {
      setViewportH(vv.height);
      bumpStick(); // 키보드 열림/닫힘 때 최신 메시지·입력창을 위로
    }
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [isMember, bumpStick]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/finz/party/${groupId}/chat?after=${cursorRef.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        status: string;
        members?: FinzChatMemberLite[];
        full?: boolean;
        messages?: FinzChatMessage[];
        cursor?: number;
      };
      if (json.status !== "ok") return;
      // 폴링마다 새 배열 참조로 setMembers 하면 매 틱 부모 리렌더 → nudge 재계산·스크롤 흔들림.
      // 실제 변화가 있을 때만 갱신한다.
      if (json.members) {
        const next = json.members;
        setMembers((prev) => (sameMembers(prev, next) ? prev : next));
      }
      const nextFull = Boolean(json.full);
      setFull((prev) => (prev === nextFull ? prev : nextFull));
      const incoming = json.messages ?? [];
      if (incoming.length) {
        setMessages((prev) => {
          // id 로 dedup — 배치 내 중복(같은 clientId 재시도)·재수신 모두 합친다(중복 React key 방지).
          const byId = new Map(prev.map((m) => [m.id, m]));
          let changed = false;
          for (const m of incoming) {
            if (!byId.has(m.id)) {
              byId.set(m.id, m);
              changed = true;
            }
          }
          if (!changed) return prev;
          return [...byId.values()].sort((a, b) => a.seq - b.seq);
        });
      }
      if (typeof json.cursor === "number" && json.cursor > cursorRef.current) {
        cursorRef.current = json.cursor;
      }
    } catch {
      // 일시적 네트워크 실패는 무시 — 다음 틱에서 재시도.
    }
  }, [groupId]);

  // 가시성 적응 폴링(멤버일 때만). 보일 때 3s, 숨김 8s. 탭 복귀 시 즉시 1회.
  useEffect(() => {
    if (!isMember) return;
    let timer: ReturnType<typeof setInterval>;
    function schedule() {
      clearInterval(timer);
      const ms = typeof document !== "undefined" && document.visibilityState === "hidden" ? 8000 : 3000;
      timer = setInterval(() => void refetch(), ms);
    }
    function onVis() {
      void refetch();
      schedule();
    }
    schedule();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isMember, refetch]);

  async function join(selectedCardIds: string[], displayName: string) {
    setJoining(true);
    setJoinError(null);
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${groupId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, displayName, selectedCardIds }),
      });
      const json = (await res.json()) as { status: string; group?: { members?: FinzChatMemberLite[] } };
      if (res.status === 409) throw new Error("이 파티는 이미 2명으로 가득 찼어요.");
      if (!res.ok || json.status !== "ok") throw new Error("합류하지 못했어요. 잠시 뒤 다시 시도해주세요.");
      rememberPartyMembership(groupId, memberId);
      if (json.group?.members) setMembers(json.group.members);
      setMyMemberId(memberId);
      await refetch();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "합류하지 못했어요.");
    } finally {
      setJoining(false);
    }
  }

  async function sendText(text: string) {
    const memberId = getOrCreateMemberId();
    const tempId = crypto.randomUUID();
    setPending((p) => [...p, { tempId, text, status: "sending" }]);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, text, id: tempId }), // tempId=메시지 id → 재시도해도 dedup 으로 합쳐짐
      });
      const json = (await res.json()) as { status: string };
      if (!res.ok || json.status !== "ok") throw new Error("send-failed");
      await refetch();
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      setTimeout(() => void refetch(), 1200); // 상대 응답을 빠르게 당겨오기
    } catch {
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: "failed" } : x)));
    }
  }

  function retryPending(tempId: string) {
    const item = pending.find((x) => x.tempId === tempId);
    if (!item) return;
    setPending((p) => p.filter((x) => x.tempId !== tempId));
    void sendText(item.text);
  }

  async function openPick(force: boolean) {
    setPickBusy(true);
    setActionError(null);
    bumpStick(); // 타이핑 버블을 바로 화면에
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${groupId}/pick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force, memberId }),
      });
      if (!res.ok) setActionError("우정주를 뽑지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      setPickBusy(false);
      bumpStick();
    }
  }

  async function submitPosition(stance: FinzPartyStance, note: string) {
    setPositionSubmitting(true);
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${groupId}/position`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, stance, note }),
      });
      if (res.ok) {
        await refetch();
        setStanceMode(false);
        bumpStick();
      }
    } catch {
      // 무시
    } finally {
      setPositionSubmitting(false);
    }
  }

  async function openSummary() {
    setSummaryBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch(`/api/finz/party/${groupId}/pick/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) setActionError("요약을 만들지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      setSummaryBusy(false);
      bumpStick();
    }
  }

  function copyShareLink() {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  function onNudgeCta(cta: FinzNudge["cta"]) {
    if (cta === "invite") copyShareLink();
    else if (cta === "pick") void openPick(false);
    else if (cta === "position") setStanceMode(true);
    else if (cta === "summary") void openSummary();
  }

  // ── 분기: id 해석 전엔 로딩, 비멤버는 조인/풀 안내, 멤버는 풀블리드 메신저 ──
  if (!idResolved) {
    return <div className="px-4 py-10 text-center text-sm text-[var(--fz-muted)]">채팅방을 여는 중…</div>;
  }
  if (!isMember && full) return <FinzRoomFullNotice />;
  if (!isMember) {
    return (
      <FinzJoinView
        inviterName={members[0]?.displayName ?? null}
        joining={joining}
        error={joinError}
        onJoin={join}
      />
    );
  }

  // 멤버 — 파생 상태
  const latestPick = selectLatestPick(messages);
  const hasPick = latestPick != null;
  const positions: Map<string, LatestPosition> = latestPick
    ? selectLatestPositionsByMember(messages, latestPick.seq)
    : new Map<string, LatestPosition>();
  const bothPositioned = full && members.every((m) => positions.has(m.memberId));
  const myPos = myMemberId ? positions.get(myMemberId) : undefined;
  const nudge = computeNextNudge(messages, members, myMemberId);

  return (
    <div
      className={`flex min-h-0 flex-col ${viewportH ? "" : "flex-1"}`}
      style={viewportH ? { height: `${viewportH}px` } : undefined}
    >
      <FinzChatHeader
        members={members}
        myMemberId={myMemberId}
        themeName={latestPick?.payload.name ?? null}
        shareUrl={shareUrl}
        full={full}
      />
      <FinzChatTimeline
        messages={messages}
        pending={pending}
        myMemberId={myMemberId}
        nudge={nudge}
        aiBusy={pickBusy || summaryBusy}
        stickSignal={stickSignal}
        onReroll={() => void openPick(true)}
        onNudgeCta={onNudgeCta}
        onRetryPending={retryPending}
      />
      {actionError && (
        <div className="flex-none px-4 pt-1">
          <p className="fz-alert">{actionError}</p>
        </div>
      )}
      <FinzChatComposer
        full={full}
        hasPick={hasPick}
        canSummarize={bothPositioned}
        sending={false}
        pickBusy={pickBusy}
        summaryBusy={summaryBusy}
        positionSubmitting={positionSubmitting}
        myLatestStance={myPos?.stance ?? null}
        myLatestNote={myPos?.note ?? ""}
        stanceMode={stanceMode}
        onSetStanceMode={setStanceMode}
        onSendText={sendText}
        onPick={() => void openPick(false)}
        onPosition={submitPosition}
        onSummary={openSummary}
      />
    </div>
  );
}
