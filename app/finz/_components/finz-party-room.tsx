"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import type { FinzRoomKind, FinzRoomSummary } from "@/lib/common/services/finz-account";
import { canListenToFinzMessage } from "@/lib/common/services/finz-message-listen";
import { isFinzMonthlyReviewCommand } from "@/lib/common/services/finz-monthly-review";
import {
  computeNextNudge,
  finzMessageSnippet,
  FINZ_REACTION_EMOJIS,
  type FinzReactionEmoji,
  mentionsFinz,
  normalizeChartSymbol,
  resolveThreadRootId,
  selectLatestPick,
  selectLatestPositionsByMember,
  selectThreadRoots,
  stripFinzMention,
  threadStats,
  type FinzAttachment,
  type FinzChatMemberLite,
  type FinzChatMessage,
  type FinzChatMode,
  type FinzImageQuality,
  type FinzNudge,
  type LatestPosition,
} from "@/lib/common/services/finz-chat";
import { useFinzAccount } from "./finz-account-context";
import { FinzChatComposer } from "./finz-chat-composer";
import { FinzChatHeader } from "./finz-chat-header";
import { FinzChatTimeline, type PendingText } from "./finz-chat-timeline";
import { FinzThreadView } from "./finz-thread-view";
import { FinzRoomFullNotice } from "./finz-room-full-notice";
import { FinzRoomJoinView } from "./finz-room-join-view";
import { FinzInviteSheet } from "./finz-invite-sheet";
import { useFinzMessageSpeech } from "./use-finz-message-speech";

// 그룹방 정원(서버 MAX_ROOM_MEMBERS 와 동일). 이 이상이면 비멤버는 못 들어옴.
const ROOM_CAPACITY = 12;

// 선제 개입(finz 가 @finz 멘션 없이 대화에 끼어들어 LLM 을 쓰던 기능)은 사용자 요청으로 비활성.
// 이제 finz 는 @finz 멘션(하단 + 메뉴의 'FINZ에게 물어보기' 포함)에만 응답한다 — 비멘션 LLM 사용/토큰 절감.
// 되살리려면 true 로 바꾸면 됨(proactive API 라우트는 그대로 두어 즉시 재사용 가능).
const FINZ_PROACTIVE_ENABLED = false;

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
  initialRevision,
  initialFull,
  initialKind,
  initialTitle,
  initialChatMode,
  initialImageQuality,
  attachmentsEnabled = false,
}: {
  groupId: string;
  initialMembers: FinzChatMemberLite[];
  initialMessages: FinzChatMessage[];
  initialCursor: number;
  initialRevision: number;
  initialFull: boolean;
  initialKind: FinzRoomKind;
  initialTitle: string;
  initialChatMode: FinzChatMode;
  initialImageQuality: FinzImageQuality;
  attachmentsEnabled?: boolean; // Blob 스토어 연결 여부 — 첨부 UI 노출 게이트
}) {
  // 메신저: 방 멤버 = 로그인 계정. memberId 는 곧 내 accountId(게이트 통과 → 항상 존재).
  const account = useFinzAccount();
  const myMemberId = account.accountId;

  const [members, setMembers] = useState<FinzChatMemberLite[]>(initialMembers);
  const [full, setFull] = useState(initialFull); // 서버 의미: 2명 이상(파티 준비)
  const [messages, setMessages] = useState<FinzChatMessage[]>(initialMessages);
  const [chatMode, setChatMode] = useState<FinzChatMode>(initialChatMode); // 방 대화 방식(폴링으로 갱신)
  const [imageQuality, setImageQuality] = useState<FinzImageQuality>(initialImageQuality); // 방 이미지 화질(폴링으로 갱신)
  const [openThreadRootId, setOpenThreadRootId] = useState<string | null>(null); // 열려 있는 스레드의 root id
  const cursorRef = useRef(initialCursor);
  const revisionRef = useRef(initialRevision);

  const [shareUrl, setShareUrl] = useState("");
  const [pending, setPending] = useState<PendingText[]>([]);
  const [actionMenu, setActionMenu] = useState<{ message: FinzChatMessage; x: number; y: number } | null>(null);
  const [replyTarget, setReplyTarget] = useState<FinzChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<Extract<FinzChatMessage, { kind: "text" }> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinzChatMessage | null>(null);
  const [shareTarget, setShareTarget] = useState<FinzChatMessage | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [recapBusy, setRecapBusy] = useState(false); // 대화 요약(general — @finz/+메뉴/nudge)
  const [monthlyReviewBusy, setMonthlyReviewBusy] = useState(false);
  const [askBusy, setAskBusy] = useState(false);
  const [mentionBusy, setMentionBusy] = useState(false); // @finz 의도 분류~기능 응답까지 타이핑 인디케이터 유지
  const [positionSubmitting, setPositionSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [needsCharacter, setNeedsCharacter] = useState(false); // 합류 실패가 '캐릭터 없음'이면 프로필 CTA 노출
  const [stanceMode, setStanceMode] = useState(false);
  const [stickSignal, setStickSignal] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewportH, setViewportH] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const bumpStick = useCallback(() => setStickSignal((s) => s + 1), []);
  const handleShareError = useCallback((message: string) => setActionError(message), []);
  const handleSpeechError = useCallback((message: string) => setActionError(message), []);
  const messageSpeech = useFinzMessageSpeech(handleSpeechError);

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

  const applyUpdatedMessage = useCallback((message: FinzChatMessage, revision?: number) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)).sort((a, b) => a.seq - b.seq));
    if (typeof revision === "number" && revision > revisionRef.current) revisionRef.current = revision;
  }, []);

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
      const res = await fetch(`/api/finz/party/${groupId}/chat?after=${cursorRef.current}&rev=${revisionRef.current}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        status: string;
        members?: FinzChatMemberLite[];
        full?: boolean;
        messages?: FinzChatMessage[];
        cursor?: number;
        revision?: number;
        chatMode?: FinzChatMode;
        imageQuality?: FinzImageQuality;
      };
      if (json.status !== "ok") return;
      if (json.members) {
        const next = json.members;
        setMembers((prev) => (sameMembers(prev, next) ? prev : next));
      }
      const nextFull = Boolean(json.full);
      setFull((prev) => (prev === nextFull ? prev : nextFull));
      if (json.chatMode === "linear" || json.chatMode === "thread") {
        setChatMode((prev) => (prev === json.chatMode ? prev : json.chatMode!)); // 토글이 폴링으로 전 멤버 전파
      }
      if (json.imageQuality) {
        const iq = json.imageQuality;
        setImageQuality((prev) => (prev === iq ? prev : iq)); // 화질 설정 변경이 폴링으로 전 멤버 전파
      }
      const incoming = json.messages ?? [];
      if (incoming.length) {
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          let changed = false;
          for (const m of incoming) {
            const prevMsg = byId.get(m.id);
            if (!prevMsg || JSON.stringify(prevMsg) !== JSON.stringify(m)) {
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
      if (typeof json.revision === "number" && json.revision > revisionRef.current) {
        revisionRef.current = json.revision;
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

  // 정기 메시지 tick — 방이 열려 있는 동안 주기적으로 "발송 시각 지난 정기 메시지"를 즉시 보내게 한다.
  // GitHub cron(잦은 스케줄)은 지연·누락이 잦아, 방을 보고 있을 땐 클라가 직접 트리거(서버가 60초 스로틀).
  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;
    async function tick() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/finz/party/${groupId}/recurring/tick`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId: myMemberId }),
        });
        const json = (await res.json().catch(() => ({}))) as { fired?: number };
        if (!cancelled && json.fired && json.fired > 0) {
          await refetch();
          setTimeout(() => void refetch(), 1500);
        }
      } catch {
        // tick 은 best-effort — 실패해도 cron 백업이 있다.
      }
    }
    const first = setTimeout(() => void tick(), 4000); // 진입 직후 한 번(밀린 발송 빠르게)
    const timer = setInterval(() => void tick(), 60000); // 이후 60초마다(서버 스로틀과 동일)
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [isMember, groupId, myMemberId, refetch]);

  // 세션 인증 원탭 합류 — 취향 재선택 없이 계정 캐릭터로 들어간다(불특정 다수도 링크로).
  async function join() {
    setJoining(true);
    setJoinError(null);
    setNeedsCharacter(false);
    try {
      const res = await fetch(`/api/finz/rooms/${groupId}/join`, { method: "POST" });
      const json = (await res.json()) as { status: string; reason?: string };
      if (res.status === 409) throw new Error("이 대화방은 정원이 가득 찼어요.");
      if (json.reason === "my-character") {
        setNeedsCharacter(true); // join-view 가 '캐릭터 만들러 가기' CTA 를 띄우게(막다른 길 방지)
        throw new Error("들어가려면 먼저 캐릭터를 만들어야 해.");
      }
      if (!res.ok || json.status !== "ok") throw new Error("들어가지 못했어요. 잠시 뒤 다시 시도해주세요.");
      await refetch();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "들어가지 못했어요.");
    } finally {
      setJoining(false);
    }
  }

  async function sendText(
    text: string,
    reuseId?: string,
    attempt = 0,
    replyToId?: string,
    attachments?: FinzAttachment[],
  ) {
    const tempId = reuseId ?? crypto.randomUUID();
    if (attempt === 0) {
      // parentId 를 실어 스레드 답글 pending 은 스레드 뷰에만, 최상위 pending 은 메인에만 뜨게 한다.
      // attachments 는 낙관적 버블에서 썸네일로 미리 보여준다(업로드는 이미 끝나 실제 Blob URL 을 들고 있음).
      setPending((p) => [...p, { tempId, text, status: "sending", parentId: replyToId, attachments }]);
      bumpStick();
    }
    try {
      const res = await fetch(`/api/finz/party/${groupId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text, id: tempId, replyToId, attachments }),
      });
      // 빠른 연속 전송이 800ms 레이트리밋(429)에 걸려도 '전송 실패'로 보이지 않게 — 같은 id 라 서버가
      // 멱등 처리하므로 잠깐 뒤 1회 자동 재전송한다('보내는 중'이 잠깐 길어질 뿐, 메시지는 안 잃는다).
      if (res.status === 429 && attempt < 1) {
        await new Promise((r) => setTimeout(r, 900));
        return sendText(text, tempId, attempt + 1, replyToId, attachments);
      }
      const json = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || json.status !== "ok") throw new Error("send-failed");
      await refetch();
      setReplyTarget(null);
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      setTimeout(() => void refetch(), 1200);
      if (mentionsFinz(text)) {
        const q = stripFinzMention(text);
        if (!q) setActionError("@finz 뒤에 궁금한 걸 적어줘.");
        else if (replyToId) void ask(q, replyToId); // 스레드 안 @finz = qa 답변을 그 스레드에(카드/부작용 인텐트는 최상위 전용)
        else void handleMention(q); // 최상위 @finz → 의도 분류 후 분기(우정주/요약/입장/차트/질문)
      } else {
        // 멘션이 아니면 finz 가 선제 개입할 맥락인지 서버가 판단(조건·쿨다운 통과 시에만 발화).
        void triggerProactive();
      }
    } catch {
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: "failed" } : x)));
    }
  }

  async function mutateMessage(
    messageId: string,
    body: { action: "react"; emoji: FinzReactionEmoji | null } | { action: "edit"; text: string } | { action: "delete" },
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/finz/party/${groupId}/message/${messageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, ...body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: FinzChatMessage;
        revision?: number;
        reason?: string;
      };
      if (!res.ok || json.status !== "ok" || !json.message) {
        setActionError(json.reason === "empty" ? "수정할 내용을 입력해줘." : "메시지를 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
        return false;
      }
      applyUpdatedMessage(json.message, json.revision);
      return true;
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
      return false;
    }
  }

  async function reactToMessage(message: FinzChatMessage, emoji: FinzReactionEmoji) {
    setActionMenu(null);
    await mutateMessage(message.id, { action: "react", emoji });
  }

  function replyToMessage(message: FinzChatMessage) {
    setActionMenu(null);
    // 스레드 모드: 답장 = 그 메시지가 속한 스레드를 연다(별도 스레드 화면에서 답글). 인라인 인용답장은 일반 모드 전용.
    if (chatMode === "thread") {
      openThread(resolveThreadRootId(new Map(liveRef.current.messages.map((m) => [m.id, m])), message));
      return;
    }
    setEditingMessage(null);
    setReplyTarget(message);
    bumpStick();
  }

  // 스레드 열기 — root id 로. (root 로 이미 해석된 id 를 받는다.)
  function openThread(rootId: string) {
    setActionMenu(null);
    setReplyTarget(null);
    setOpenThreadRootId(rootId);
  }

  // 스레드 답글 전송 — 항상 root 에 대한 답장(replyTo=rootId)으로 2단계 유지. @finz 포함 시 sendText 가 스레드로 라우팅.
  function sendReplyInThread(text: string, rootId: string) {
    void sendText(text, undefined, 0, rootId);
  }

  function editMessage(message: FinzChatMessage) {
    setActionMenu(null);
    if (message.kind !== "text" || message.authorId !== myMemberId || message.role !== "member" || message.deletedAt) return;
    setReplyTarget(null);
    setEditingMessage(message);
    bumpStick();
  }

  async function submitEdit(text: string) {
    if (!editingMessage) return;
    const ok = await mutateMessage(editingMessage.id, { action: "edit", text });
    if (ok) {
      setEditingMessage(null);
      bumpStick();
    }
  }

  function askDeleteMessage(message: FinzChatMessage) {
    setActionMenu(null);
    if (message.authorId !== myMemberId || message.role !== "member" || message.deletedAt) return;
    setDeleteTarget(message);
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return;
    const ok = await mutateMessage(deleteTarget.id, { action: "delete" });
    if (ok) setDeleteTarget(null);
  }

  function shareMessage(message: FinzChatMessage) {
    setActionMenu(null);
    setShareTarget(message);
  }

  // @finz 멘션 → 서버에 의도 분류 요청 후 분기. 분류 실패/qa 면 기존 그라운딩 답변(ask)으로 폴백.
  // pick/summary/position 은 기존 핸들러를 재사용하되, 전제조건(정원·픽·입장)을 먼저 가드해 친절히 안내.
  async function handleMention(question: string) {
    // 의도 분류(~1s)부터 분기된 기능의 응답까지 타이핑 인디케이터를 켜둔다 — 멘션 직후 봇이 '죽은 것처럼'
    // 보이지 않게(분기를 await 로 기다려, 차트·브리핑·스케줄처럼 자체 busy 가 없는 경로도 공백이 안 생김).
    setMentionBusy(true);
    bumpStick();
    try {
      setActionError(null);
      if (isFinzMonthlyReviewCommand(question)) {
        await openMonthlyReview();
        return;
      }
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
        await openPick(false);
        return;
      }
      if (intent === "summary") {
        // 대화 요약(general) — 전제조건 없음. 질문 텍스트를 그대로 보내 명시 기간(어제부터/최근 1시간/N개)을 서버가 파싱.
        await openRecap(question);
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
          await openChart(normalized, question);
          return;
        }
        await ask(question);
        return;
      }
      if (intent === "briefing") {
        // 매일 아침 시황 구독/해지(기본 구독). 서버가 토글 + 확인 메시지 append.
        await subscribeBriefing(subscribe !== false);
        return;
      }
      if (intent === "schedule") {
        // 임의의 정기 메시지 등록 — 서버가 자연어에서 주기·시각·내용을 추출해 등록 + 확인 메시지 append.
        await scheduleRecurring(question);
        return;
      }
      if (intent === "portfolio") {
        // 매수/매도 기록 · 보유현황·수익률 조회 · 섹터 분석 — 서버가 추출·계산해 메시지/카드 append.
        await handlePortfolio(question);
        return;
      }
      // qa(기본) — 기존 그라운딩 답변.
      await ask(question);
    } finally {
      setMentionBusy(false);
      bumpStick();
    }
  }

  // @finz 포트폴리오 — 서버가 기록/조회/섹터를 판단해 확인 메시지나 포트폴리오 카드를 append, 폴링으로 뜬다.
  async function handlePortfolio(text: string) {
    setAskBusy(true); // 카드/현재가 조회가 오는 동안 타이핑 인디케이터
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/portfolio/handle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text }),
      });
      const json = (await res.json().catch(() => ({}))) as { busy?: boolean };
      if (!res.ok) setActionError("포트폴리오를 처리하지 못했어. 잠시 뒤 다시 시도해줘.");
      else if (json.busy) setActionError("포트폴리오를 정리하는 중이야 — 잠깐 뒤 다시 물어봐줘.");
      await refetch();
      setTimeout(() => void refetch(), 1500);
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      setAskBusy(false);
      bumpStick();
    }
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

  // replyToId 를 주면(스레드 안 @finz) 그 스레드에 묶어 답한다 — 서버가 답변을 replyTo=대상 으로 append.
  async function ask(question: string, replyToId?: string) {
    setAskBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, question, replyToId }),
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
    if (!FINZ_PROACTIVE_ENABLED) return; // 비활성(위 상수) — finz 는 @finz 멘션에만 응답
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
    void sendText(item.text, tempId, 0, item.parentId, item.attachments);
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

  // 현재 방의 마지막 월간 리뷰 이후 투자 대화를 실제 시가와 함께 회고한다.
  // 중간 리뷰는 전달 정기 리뷰의 가격 기준선을 바꾸지 않는다.
  async function openMonthlyReview() {
    setMonthlyReviewBusy(true);
    setActionError(null);
    bumpStick();
    try {
      const res = await fetch(`/api/finz/party/${groupId}/monthly-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId }),
      });
      if (!res.ok) setActionError("월간 리뷰를 만들지 못했어. 잠시 뒤 다시 시도해줘.");
      await refetch();
    } catch {
      setActionError("연결이 잠깐 끊겼어. 다시 시도해줘.");
    } finally {
      setMonthlyReviewBusy(false);
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
    // nudge 의 'AI 요약 받기' → 전제조건 없는 일반 대화 요약(우정주 입장 기반 파티 요약은 안 됨이 잦아 통일).
    else if (cta === "summary") void openRecap();
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
        needsCharacter={needsCharacter}
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
  const replyReference = replyTarget
    ? {
        id: replyTarget.id,
        authorName: replyTarget.role === "finz" ? "FINZ" : replyTarget.authorName || "친구",
        snippet: finzMessageSnippet(replyTarget),
        kind: replyTarget.kind,
      }
    : null;
  const editingReference = editingMessage
    ? {
        id: editingMessage.id,
        authorName: editingMessage.authorName || "나",
        snippet: finzMessageSnippet(editingMessage),
        kind: editingMessage.kind,
        text: editingMessage.text,
      }
    : null;

  // 스레드 모드: 메인 타임라인엔 '원글'만(답글은 스레드로), 답글 수 어포던스용 stats, pending 은 최상위만.
  const threadMode = chatMode === "thread";
  const timelineMessages = threadMode ? selectThreadRoots(messages) : messages;
  const stats = threadMode ? threadStats(messages) : undefined;
  const mainPending = threadMode ? pending.filter((p) => !p.parentId) : pending;

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
        messages={timelineMessages}
        pending={mainPending}
        myMemberId={myMemberId}
        groupId={groupId}
        mentionNames={members.map((m) => m.displayName)}
        nudge={nudge}
        aiBusy={pickBusy || recapBusy || monthlyReviewBusy || askBusy || mentionBusy}
        stickSignal={stickSignal}
        chatMode={chatMode}
        threadStats={stats}
        onOpenThread={openThread}
        onReroll={() => void openPick(true)}
        onNudgeCta={onNudgeCta}
        onRetryPending={retryPending}
        speechSupported={messageSpeech.supported}
        activeSpeechMessageId={messageSpeech.activeMessageId}
        speechStatus={messageSpeech.status}
        onToggleSpeech={messageSpeech.toggle}
        onStopSpeech={messageSpeech.stop}
        onOpenMessageActions={(message, point) => {
          if (message.kind === "system" || message.deletedAt) return;
          setActionMenu({ message, x: point.x, y: point.y });
        }}
        onReplyTargetUnavailable={() => setActionError("원문 메시지를 찾을 수 없어요.")}
      />
      {actionMenu && (
        <FinzMessageActionMenu
          message={actionMenu.message}
          x={actionMenu.x}
          y={actionMenu.y}
          myMemberId={myMemberId}
          speechSupported={messageSpeech.supported}
          onClose={() => setActionMenu(null)}
          onReact={(emoji) => void reactToMessage(actionMenu.message, emoji)}
          onListen={() => {
            messageSpeech.speak(actionMenu.message);
            setActionMenu(null);
          }}
          onReply={() => replyToMessage(actionMenu.message)}
          onShare={() => shareMessage(actionMenu.message)}
          onEdit={() => editMessage(actionMenu.message)}
          onDelete={() => askDeleteMessage(actionMenu.message)}
        />
      )}
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
        monthlyReviewBusy={monthlyReviewBusy}
        positionSubmitting={positionSubmitting}
        myLatestStance={myPos?.stance ?? null}
        myLatestNote={myPos?.note ?? ""}
        stanceMode={stanceMode}
        attachmentsEnabled={attachmentsEnabled}
        imageQuality={imageQuality}
        mentionNames={members.map((m) => m.displayName)}
        replyTarget={threadMode ? null : replyReference}
        editingTarget={editingReference}
        onSetStanceMode={setStanceMode}
        onSendText={(text, replyToId, attachments) => void sendText(text, undefined, 0, replyToId, attachments)}
        onEditText={(text) => void submitEdit(text)}
        onCancelReply={() => setReplyTarget(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onPick={() => void openPick(false)}
        onPosition={submitPosition}
        onRecap={() => void openRecap()}
        onMonthlyReview={() => void openMonthlyReview()}
      />
      {deleteTarget && (
        <FinzDeleteConfirm
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteMessage()}
        />
      )}
      {shareTarget && (
        <FinzShareSheet
          currentRoomId={groupId}
          sourceMessage={shareTarget}
          myMemberId={myMemberId}
          onClose={() => setShareTarget(null)}
          onSent={() => {
            setShareTarget(null);
            setActionError(null);
          }}
          onError={handleShareError}
        />
      )}
      {inviteOpen && (
        <FinzInviteSheet
          shareUrl={shareUrl}
          existingMemberIds={members.map((m) => m.memberId)}
          onInvite={inviteFriends}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {openThreadRootId && (
        <FinzThreadView
          rootId={openThreadRootId}
          messages={messages}
          pending={pending.filter((p) => p.parentId === openThreadRootId)}
          myMemberId={myMemberId}
          groupId={groupId}
          mentionNames={members.map((m) => m.displayName)}
          aiBusy={askBusy || mentionBusy}
          viewportH={viewportH}
          onClose={() => setOpenThreadRootId(null)}
          onSendReply={sendReplyInThread}
          onRetryPending={retryPending}
          speechSupported={messageSpeech.supported}
          activeSpeechMessageId={messageSpeech.activeMessageId}
          speechStatus={messageSpeech.status}
          onToggleSpeech={messageSpeech.toggle}
          onStopSpeech={messageSpeech.stop}
        />
      )}
    </div>
  );
}

function FinzMessageActionMenu({
  message,
  x,
  y,
  myMemberId,
  speechSupported,
  onClose,
  onReact,
  onListen,
  onReply,
  onShare,
  onEdit,
  onDelete,
}: {
  message: FinzChatMessage;
  x: number;
  y: number;
  myMemberId: string;
  speechSupported: boolean;
  onClose: () => void;
  onReact: (emoji: FinzReactionEmoji) => void;
  onListen: () => void;
  onReply: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const mine = message.authorId === myMemberId && message.role === "member";
  const canEdit = mine && message.kind === "text" && !message.deletedAt;
  const canDelete = mine && (message.kind === "text" || message.kind === "position") && !message.deletedAt;
  const canListen = speechSupported && canListenToFinzMessage(message);
  const selectedEmoji = message.reactions?.[myMemberId] ?? null;

  return (
    <div className="fz-action-backdrop" onClick={onClose}>
      <div
        className="fz-message-menu"
        role="menu"
        aria-label="메시지 액션"
        style={{ left: `min(${Math.max(12, x)}px, calc(100vw - 256px))`, top: `min(${Math.max(12, y)}px, calc(100vh - 320px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fz-message-menu__reactions" aria-label="기본 반응">
          {FINZ_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              draggable={false}
              aria-label={`반응 ${emoji}`}
              aria-pressed={selectedEmoji === emoji}
              onDragStart={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse" && e.cancelable) e.preventDefault();
                window.getSelection()?.removeAllRanges();
              }}
              onClick={() => onReact(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        {canListen && <button type="button" role="menuitem" onClick={onListen}>읽어주기</button>}
        <button type="button" role="menuitem" onClick={onReply}>답장</button>
        <button type="button" role="menuitem" onClick={onShare}>공유</button>
        {canEdit && <button type="button" role="menuitem" onClick={onEdit}>수정</button>}
        {canDelete && <button type="button" role="menuitem" className="fz-message-menu__danger" onClick={onDelete}>삭제</button>}
      </div>
    </div>
  );
}

function FinzDeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fz-modal-backdrop" role="presentation">
      <div className="fz-confirm" role="dialog" aria-modal="true" aria-labelledby="finz-delete-title">
        <h2 id="finz-delete-title">메시지를 삭제할까요?</h2>
        <p>대화방에는 “삭제된 메시지입니다”로 남아요.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="fz-btn fz-btn--ghost" onClick={onCancel}>취소</button>
          <button type="button" className="fz-btn" onClick={onConfirm}>삭제</button>
        </div>
      </div>
    </div>
  );
}

function FinzShareSheet({
  currentRoomId,
  sourceMessage,
  myMemberId,
  onClose,
  onSent,
  onError,
}: {
  currentRoomId: string;
  sourceMessage: FinzChatMessage;
  myMemberId: string;
  onClose: () => void;
  onSent: () => void;
  onError: (message: string) => void;
}) {
  const [rooms, setRooms] = useState<FinzRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/finz/rooms", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { status?: string; rooms?: FinzRoomSummary[] };
        if (!cancelled && res.ok && json.status === "ok") setRooms(json.rooms ?? []);
      } catch {
        if (!cancelled) onError("공유할 대화방 목록을 불러오지 못했어.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const shareText = `공유한 메시지\n${sourceMessage.role === "finz" ? "FINZ" : sourceMessage.authorName || "친구"}: ${finzMessageSnippet(sourceMessage, 160)}`;
  const visibleRooms = rooms.filter((r) => r.roomId !== currentRoomId && r.kind !== "self");

  async function sendToRoom(roomId: string, mode: "room" | "self") {
    setSendingTo(mode === "self" ? "self" : roomId);
    try {
      let targetRoomId = roomId;
      if (mode === "self") {
        const selfRes = await fetch("/api/finz/rooms/self", { method: "POST" });
        const selfJson = (await selfRes.json().catch(() => ({}))) as { status?: string; roomId?: string };
        if (!selfRes.ok || selfJson.status !== "ok" || !selfJson.roomId) throw new Error("self-room");
        targetRoomId = selfJson.roomId;
      }
      const res = await fetch(`/api/finz/party/${targetRoomId}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: myMemberId, text: shareText, id: crypto.randomUUID() }),
      });
      const json = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || json.status !== "ok") throw new Error("send");
      onSent();
    } catch {
      onError("메시지를 공유하지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setSendingTo(null);
    }
  }

  return (
    <div className="fz-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="fz-share-sheet" role="dialog" aria-modal="true" aria-labelledby="finz-share-title" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="finz-share-title">공유할 채팅방</h2>
          <button type="button" className="fz-btn fz-btn--ghost h-8 w-8" style={{ padding: 0 }} aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="fz-share-preview">{shareText}</div>
        <div className="fz-share-list">
          {loading && <p className="px-2 py-3 text-sm text-[var(--fz-muted)]">대화방을 불러오는 중…</p>}
          {!loading && visibleRooms.length === 0 && (
            <p className="px-2 py-3 text-sm text-[var(--fz-muted)]">공유할 다른 대화방이 아직 없어요.</p>
          )}
          {visibleRooms.map((room) => (
            <button
              key={room.roomId}
              type="button"
              disabled={sendingTo != null}
              onClick={() => void sendToRoom(room.roomId, "room")}
            >
              <span>{room.title}</span>
              <small>{room.kind === "group" ? "그룹 채팅" : "1:1 채팅"}</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="fz-share-self"
          disabled={sendingTo != null}
          onClick={() => void sendToRoom("", "self")}
        >
          나에게 보내기
        </button>
      </div>
    </div>
  );
}
