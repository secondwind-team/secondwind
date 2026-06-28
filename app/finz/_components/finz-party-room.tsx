"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import type { FinzRoomKind } from "@/lib/common/services/finz-account";
import {
  computeNextNudge,
  mentionsFinz,
  normalizeChartSymbol,
  selectLatestPick,
  selectLatestPositionsByMember,
  stripFinzMention,
  type FinzChatMemberLite,
  type FinzChatMessage,
  type FinzNudge,
  type LatestPosition,
} from "@/lib/common/services/finz-chat";
import { useFinzAccount } from "./finz-account-context";
import { FinzChatComposer } from "./finz-chat-composer";
import { FinzChatHeader } from "./finz-chat-header";
import { FinzChatTimeline, type PendingText } from "./finz-chat-timeline";
import { FinzRoomFullNotice } from "./finz-room-full-notice";
import { FinzRoomJoinView } from "./finz-room-join-view";
import { FinzInviteSheet } from "./finz-invite-sheet";

// 그룹방 정원(서버 MAX_ROOM_MEMBERS 와 동일). 이 이상이면 비멤버는 못 들어옴.
const ROOM_CAPACITY = 12;

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
  initialKind,
  initialTitle,
}: {
  groupId: string;
  initialMembers: FinzChatMemberLite[];
  initialMessages: FinzChatMessage[];
  initialCursor: number;
  initialFull: boolean;
  initialKind: FinzRoomKind;
  initialTitle: string;
}) {
  // 메신저: 방 멤버 = 로그인 계정. memberId 는 곧 내 accountId(게이트 통과 → 항상 존재).
  const account = useFinzAccount();
  const myMemberId = account.accountId;

  const [members, setMembers] = useState<FinzChatMemberLite[]>(initialMembers);
  const [full, setFull] = useState(initialFull); // 서버 의미: 2명 이상(파티 준비)
  const [messages, setMessages] = useState<FinzChatMessage[]>(initialMessages);
  const cursorRef = useRef(initialCursor);

  const [shareUrl, setShareUrl] = useState("");
  const [pending, setPending] = useState<PendingText[]>([]);
  const [pickBusy, setPickBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false); // 파티 요약(우정주 입장 기반, nudge 전용)
  const [recapBusy, setRecapBusy] = useState(false); // 대화 요약(general — @finz/+메뉴)
  const [askBusy, setAskBusy] = useState(false);
  const [positionSubmitting, setPositionSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [stanceMode, setStanceMode] = useState(false);
  const [stickSignal, setStickSignal] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewportH, setViewportH] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const bumpStick = useCallback(() => setStickSignal((s) => s + 1), []);

  // 폴링이 비동기로 state 를 바꾸므로, handleMention 이 분류 응답(~1s)을 기다린 뒤 가드할 때
  // 클로저 옛값 대신 "최신 커밋된" 상태를 읽도록 ref 로 미러링한다(스테일 가드 메시지 방지).
  const liveRef = useRef({ messages, members, full });
  useEffect(() => {
    liveRef.current = { messages, members, full };
  }, [messages, members, full]);

  const isMember = members.some((m) => m.memberId === myMemberId);
  const atCapacity = members.length >= ROOM_CAPACITY;

  useEffect(() => {
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, [groupId]);

  // 모바일 키보드 대응: visualViewport 높이에 맞춰 입력바가 키보드 뒤로 숨지 않게.
  useEffect(() => {
    if (!isMember || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    function sync() {
      setViewportH(vv.height);
      bumpStick();
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
      if (json.members) {
        const next = json.members;
        setMembers((prev) => (sameMembers(prev, next) ? prev : next));
      }
      const nextFull = Boolean(json.full);
      setFull((prev) => (prev === nextFull ? prev : nextFull));
      const incoming = json.messages ?? [];
      if (incoming.length) {
        setMessages((prev) => {
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
      // 일시적 네트워크 실패 무시 — 다음 틱 재시도.
    }
  }, [groupId]);

  // 가시성 적응 폴링(멤버일 때만). 보일 때 3s, 숨김 8s.
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

  // 세션 인증 원탭 합류 — 취향 재선택 없이 계정 캐릭터로 들어간다(불특정 다수도 링크로).
  async function join() {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/finz/rooms/${groupId}/join`, { method: "POST" });
      const json = (await res.json()) as { status: string; reason?: string };
      if (res.status === 409) throw new Error("이 대화방은 정원이 가득 찼어요.");
      if (json.reason === "my-character") throw new Error("프로필에서 캐릭터를 먼저 소환해야 들어갈 수 있어.");
      if (!res.ok || json.status !== "ok") throw new Error("들어가지 못했어요. 잠시 뒤 다시 시도해주세요.");
      await refetch();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "들어가지 못했어요.");
    } finally {
      setJoining(false);
    }
  }

  async function sendText(text: string, reuseId?: string) {
    const tempId = reuseId ?? crypto.randomUUID();
    setPending((p) => [...p, { tempId, text, status: "sending" }]);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text, id: tempId }),
      });
      const json = (await res.json()) as { status: string };
      if (!res.ok || json.status !== "ok") throw new Error("send-failed");
      await refetch();
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      setTimeout(() => void refetch(), 1200);
      if (mentionsFinz(text)) {
        // @finz 멘션 → 의도 분류 후 분기(우정주/요약/입장/질문).
        const q = stripFinzMention(text);
        if (q) void handleMention(q);
        else setActionError("@finz 뒤에 궁금한 걸 적어줘.");
      } else {
        // 멘션이 아니면 finz 가 선제 개입할 맥락인지 서버가 판단(조건·쿨다운 통과 시에만 발화).
        void triggerProactive();
      }
    } catch {
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: "failed" } : x)));
    }
  }

  // @finz 멘션 → 서버에 의도 분류 요청 후 분기. 분류 실패/qa 면 기존 그라운딩 답변(ask)으로 폴백.
  // pick/summary/position 은 기존 핸들러를 재사용하되, 전제조건(정원·픽·입장)을 먼저 가드해 친절히 안내.
  async function handleMention(question: string) {
    setActionError(null);
    let intent: string = "qa";
    let symbol: string | undefined;
    let subscribe: boolean | undefined;
    try {
      const res = await fetch(`/api/finz/party/${groupId}/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text: question }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        intent?: string;
        symbol?: string;
        subscribe?: boolean;
      };
      if (json.status === "ok" && typeof json.intent === "string") intent = json.intent;
      if (typeof json.symbol === "string") symbol = json.symbol;
      if (typeof json.subscribe === "boolean") subscribe = json.subscribe;
    } catch {
      // 분류 호출 실패 → qa 폴백.
    }

    // 분류 대기 중 폴링으로 상태가 바뀌었을 수 있으니 최신 커밋 상태(ref)로 가드한다.
    const live = liveRef.current;
    if (intent === "pick") {
      if (!live.full) {
        setActionError("친구가 들어와야 우정주를 뽑을 수 있어. 먼저 초대해봐!");
        return;
      }
      void openPick(false);
      return;
    }
    if (intent === "summary") {
      // 대화 요약(general) — 전제조건 없음. 질문 텍스트를 그대로 보내 명시 기간(어제부터/최근 1시간/N개)을 서버가 파싱.
      void openRecap(question);
      return;
    }
    if (intent === "position") {
      if (!selectLatestPick(live.messages)) {
        setActionError("먼저 우정주를 뽑아줘. 그 주제에 대한 입장을 남길 수 있어.");
        return;
      }
      setStanceMode(true);
      return;
    }
    if (intent === "chart") {
      // 심볼이 정규화되면 차트 메시지, 아니면 일반 질문으로 폴백(가짜 차트 방지).
      const normalized = normalizeChartSymbol(symbol);
      if (normalized) {
        void openChart(normalized, question);
        return;
      }
      void ask(question);
      return;
    }
    if (intent === "briefing") {
      // 매일 아침 시황 구독/해지(기본 구독). 서버가 토글 + 확인 메시지 append.
      void subscribeBriefing(subscribe !== false);
      return;
    }
    if (intent === "schedule") {
      // 임의의 정기 메시지 등록 — 서버가 자연어에서 주기·시각·내용을 추출해 등록 + 확인 메시지 append.
      void scheduleRecurring(question);
      return;
    }
    // qa(기본) — 기존 그라운딩 답변.
    void ask(question);
  }

  // @finz 매일 아침 시황 구독/해지 → 서버가 토글 + 확인 메시지 append, 폴링으로 뜬다.
  async function subscribeBriefing(subscribe: boolean) {
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/briefing/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, subscribe }),
      });
      if (!res.ok) setActionError("시황 구독 설정을 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      bumpStick();
    }
  }

  // @finz 정기 메시지 등록 → 서버가 자연어에서 주기·시각·내용을 추출해 등록 + 확인 메시지 append, 폴링으로 뜬다.
  async function scheduleRecurring(text: string) {
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/recurring/parse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text }),
      });
      if (!res.ok) setActionError("정기 메시지를 등록하지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      bumpStick();
    }
  }

  // @finz 차트 요청 → 서버에 chart 메시지 append, 폴링으로 TradingView 위젯이 뜬다.
  async function openChart(symbol: string, label: string) {
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/chart`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, symbol, label }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { reason?: string };
        setActionError(
          json.reason === "invalid-symbol"
            ? "그 종목을 못 찾았어. 종목명을 더 분명히 말해줘 (예: @finz 테슬라 차트)."
            : "차트를 불러오지 못했어. 잠시 뒤 다시 시도해줘.",
        );
      }
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      bumpStick();
    }
  }

  async function ask(question: string) {
    setAskBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, question }),
      });
      const json = (await res.json().catch(() => ({}))) as { busy?: boolean };
      if (!res.ok) setActionError("finz 가 답하지 못했어. 잠시 뒤 다시 @finz 로 물어봐줘.");
      else if (json.busy) setActionError("finz 가 아직 답하는 중이야 — 잠깐 뒤 다시 물어봐줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 @finz 로 물어봐줘.");
    } finally {
      setAskBusy(false);
      bumpStick();
    }
  }

  // 선제 개입 트리거(백그라운드). 서버가 조건/쿨다운 미충족이면 조용히 no-op. 곧 폴링으로 뜬다.
  async function triggerProactive() {
    try {
      await fetch(`/api/finz/party/${groupId}/proactive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId }),
      });
      setTimeout(() => void refetch(), 1500);
      setTimeout(() => void refetch(), 4000);
    } catch {
      // 무시 — 선제 개입은 best-effort.
    }
  }

  function retryPending(tempId: string) {
    const item = pending.find((x) => x.tempId === tempId);
    if (!item) return;
    setPending((p) => p.filter((x) => x.tempId !== tempId));
    void sendText(item.text, tempId);
  }

  async function openPick(force: boolean) {
    setPickBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/pick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force, memberId: myMemberId }),
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
      const res = await fetch(`/api/finz/party/${groupId}/position`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, stance, note }),
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

  // 파티 요약(우정주 입장 기반 앰버 카드) — nudge CTA 전용. 전제조건은 서버가 검증(미충족 시 nudged).
  async function openSummary() {
    setSummaryBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/pick/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId }),
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

  // 대화 요약(general) — @finz 요약/+메뉴 "대화 요약". text 가 있으면 서버가 명시 기간(어제부터/최근 N개)을 파싱,
  // 없으면 100개 초과 시 최근 100개. 결과는 finz 텍스트 메시지로 채팅에 쌓인다.
  async function openRecap(text?: string) {
    setRecapBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text: text ?? "" }),
      });
      if (!res.ok) setActionError("요약을 만들지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      setRecapBusy(false);
      bumpStick();
    }
  }

  async function inviteFriends(accountIds: string[]) {
    if (accountIds.length === 0) return;
    try {
      await fetch(`/api/finz/rooms/${groupId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountIds }),
      });
      await refetch();
    } catch {
      // 무시
    } finally {
      setInviteOpen(false);
    }
  }

  function onNudgeCta(cta: FinzNudge["cta"]) {
    if (cta === "invite") setInviteOpen(true);
    else if (cta === "pick") void openPick(false);
    else if (cta === "position") setStanceMode(true);
    else if (cta === "summary") void openSummary();
  }

  // ── 분기: 비멤버는 정원초과 안내 또는 합류 뷰, 멤버는 풀블리드 메신저 ──
  if (!isMember && atCapacity) return <FinzRoomFullNotice />;
  if (!isMember) {
    return (
      <FinzRoomJoinView
        kind={initialKind}
        title={initialTitle}
        members={members}
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
  const myPos = positions.get(myMemberId);
  const isSelf = initialKind === "self";
  const isGroup = initialKind === "group";
  // 나와의 채팅에선 "친구 초대/우정주" 코칭이 어색하니 nudge 생략(자유 대화·@finz 만).
  const nudge = isSelf ? null : computeNextNudge(messages, members, myMemberId);

  return (
    <div
      className={`flex min-h-0 flex-col ${viewportH ? "" : "flex-1"}`}
      style={viewportH ? { height: `${viewportH}px` } : undefined}
    >
      <FinzChatHeader
        groupId={groupId}
        members={members}
        myMemberId={myMemberId}
        themeName={latestPick?.payload.name ?? null}
        roomTitle={isSelf ? "나와의 채팅" : isGroup ? initialTitle : null}
        full={full}
        onInvite={isSelf ? undefined : () => setInviteOpen(true)}
      />
      <FinzChatTimeline
        messages={messages}
        pending={pending}
        myMemberId={myMemberId}
        nudge={nudge}
        aiBusy={pickBusy || summaryBusy || recapBusy || askBusy}
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
        sending={false}
        pickBusy={pickBusy}
        recapBusy={recapBusy}
        positionSubmitting={positionSubmitting}
        myLatestStance={myPos?.stance ?? null}
        myLatestNote={myPos?.note ?? ""}
        stanceMode={stanceMode}
        onSetStanceMode={setStanceMode}
        onSendText={sendText}
        onPick={() => void openPick(false)}
        onPosition={submitPosition}
        onRecap={() => void openRecap()}
      />
      {inviteOpen && (
        <FinzInviteSheet
          shareUrl={shareUrl}
          existingMemberIds={members.map((m) => m.memberId)}
          onInvite={inviteFriends}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}
