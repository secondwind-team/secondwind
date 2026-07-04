// FINZ 채팅 모델 — 클라이언트/서버 공용(순수). 카카오톡식 단일 타임라인이 곧 상태다.
// 자유 텍스트·우정주 픽·멤버 포지션·AI 요약·시스템 알림이 모두 "메시지"로 쌓인다.
// 본문 메시지는 append 중심이고, 반응/답장/수정/삭제 같은 액션 메타데이터만 기존 메시지에 얹는다.
// seq 는 KV LIST 인덱스(읽기 시점 부여, 저장 안 함).
//
// nudge('이제 뭐 할지') 는 메시지가 아니다 — 현재 상태에서 클라이언트가 매 렌더 계산하는
// 비저장 코칭 버블이다(중복 저장·스팸 방지). computeNextNudge 참조.

import {
  FINZ_PARTY_STANCES,
  isFinzPartyPick,
  isFinzPartySummary,
  type FinzPartyPick,
  type FinzPartyStance,
  type FinzPartySummary,
} from "./finz";
import { isFinzPortfolioCardPayload, type FinzPortfolioCardPayload } from "./finz-portfolio";

export type FinzChatRole = "member" | "finz" | "system";
export type FinzChatKind = "text" | "system" | "pick" | "position" | "summary" | "chart" | "portfolio";

export type FinzPositionPayload = { stance: FinzPartyStance; note: string };
// 차트 메시지 페이로드 — TradingView 심볼(거래소:티커)과 표시용 라벨만 저장(이미지 아님 → 매번 라이브 렌더).
export type FinzChartPayload = { symbol: string; label: string };

export const FINZ_REACTION_EMOJIS = ["❤️", "👍", "✅", "😂", "😮", "😢"] as const;
export type FinzReactionEmoji = (typeof FINZ_REACTION_EMOJIS)[number];

export type FinzReplyReference = {
  id: string;
  authorName: string;
  snippet: string;
  kind: FinzChatKind;
};

export type FinzMessageReactions = Record<string, FinzReactionEmoji>;

// kind 별 페이로드/필수 필드를 base 제네릭으로 분기 — stored(저장형, seq 없음)와 message(읽기형, seq 있음)를
// 같은 모양으로 한 번에 정의한다.
type FinzChatVariants<B> =
  | (B & { kind: "text"; text: string })
  | (B & { kind: "system"; text: string })
  | (B & { kind: "pick"; payload: FinzPartyPick })
  | (B & { kind: "position"; payload: FinzPositionPayload })
  | (B & { kind: "summary"; payload: FinzPartySummary })
  | (B & { kind: "chart"; payload: FinzChartPayload })
  | (B & { kind: "portfolio"; payload: FinzPortfolioCardPayload });

type FinzStoredBase = {
  id: string; // crypto.randomUUID() — React key + 낙관적 전송 reconcile 의 유일 키
  role: FinzChatRole;
  authorId: string; // memberId, 또는 리터럴 "finz" / "system"
  authorName: string; // member.displayName(서버 조회), 또는 "FINZ" / ""
  createdAt: string; // ISO
  reactions?: FinzMessageReactions; // memberId -> emoji. 같은 사람이 누르면 변경/해제된다.
  replyTo?: FinzReplyReference; // 답장 작성 시점의 원본 메시지 스냅샷.
  editedAt?: string; // 일반 text 메시지 수정 시각.
  deletedAt?: string; // soft delete 시각. UI/LLM 에는 삭제 안내문으로 노출.
};

// KV LIST 에 JSON.stringify 되는 값 — seq 없음(읽기 시점 인덱스로 부여).
export type FinzStoredChatMessage = FinzChatVariants<FinzStoredBase>;
// 클라이언트/라우트가 다루는 값 — seq(절대 인덱스) 포함.
export type FinzChatMessage = FinzChatVariants<FinzStoredBase & { seq: number }>;

export type FinzChatPickMessage = Extract<FinzChatMessage, { kind: "pick" }>;
export type FinzChatPositionMessage = Extract<FinzChatMessage, { kind: "position" }>;
export type FinzChatSummaryMessage = Extract<FinzChatMessage, { kind: "summary" }>;

export type FinzChatMemberLite = {
  memberId: string;
  displayName: string;
  selectedCardIds: string[];
  joinedAt: string;
};

// nudge(코칭) — 클라이언트 전용, KV 에 절대 직렬화하지 않는다.
export type FinzNudgeCta = "invite" | "pick" | "position" | "summary";
export type FinzNudge = { cta: FinzNudgeCta; text: string; missingMemberName?: string };

export type FinzChatResponse = {
  status: "ok" | "not-found" | "error";
  members?: FinzChatMemberLite[];
  full?: boolean;
  messages?: FinzChatMessage[];
  cursor?: number; // 응답에 담긴 최대 seq — 클라이언트는 로컬 cursor 를 이 값으로 전진
  revision?: number; // 과거 메시지 메타데이터 변경 감지용(room-level mutation counter)
  expiresAt?: string;
  deduped?: boolean; // pick/summary 라우트 전용 — 락에 막혀 기존 결과를 반환했음
  nudged?: boolean; // summary 라우트 전용 — 선행 조건 미충족(에러 대신 클라이언트 nudge 유도)
};

export function isFinzReactionEmoji(value: unknown): value is FinzReactionEmoji {
  return (FINZ_REACTION_EMOJIS as readonly unknown[]).includes(value);
}

function isReplyReference(value: unknown): value is FinzReplyReference {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<FinzReplyReference>;
  return (
    typeof r.id === "string" &&
    r.id.length > 0 &&
    typeof r.authorName === "string" &&
    typeof r.snippet === "string" &&
    typeof r.kind === "string" &&
    ["text", "system", "pick", "position", "summary", "chart", "portfolio"].includes(r.kind)
  );
}

function hasValidMessageMetadata(m: Record<string, unknown>): boolean {
  if (m.reactions !== undefined) {
    if (!m.reactions || typeof m.reactions !== "object" || Array.isArray(m.reactions)) return false;
    for (const [memberId, emoji] of Object.entries(m.reactions as Record<string, unknown>)) {
      if (!memberId || !isFinzReactionEmoji(emoji)) return false;
    }
  }
  if (m.replyTo !== undefined && !isReplyReference(m.replyTo)) return false;
  if (m.editedAt !== undefined && typeof m.editedAt !== "string") return false;
  if (m.deletedAt !== undefined && typeof m.deletedAt !== "string") return false;
  return true;
}

function isPositionPayload(value: unknown): value is FinzPositionPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<FinzPositionPayload>;
  return (
    typeof p.stance === "string" &&
    (FINZ_PARTY_STANCES as readonly string[]).includes(p.stance) &&
    typeof p.note === "string"
  );
}

function isChartPayload(value: unknown): value is FinzChartPayload {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<FinzChartPayload>;
  return typeof c.symbol === "string" && c.symbol.length > 0 && typeof c.label === "string";
}

// KV 에서 읽은 값은 신뢰하지 않는다 — 기존 isFinz* 의 관용 검증 패턴을 그대로 따른다.
// 모르는 kind / 페이로드 깨짐은 드롭(해당 메시지만), 타임라인 전체는 유지.
export function isFinzStoredChatMessage(value: unknown): value is FinzStoredChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id.length === 0) return false;
  if (m.role !== "member" && m.role !== "finz" && m.role !== "system") return false;
  if (typeof m.authorId !== "string" || m.authorId.length === 0) return false;
  if (typeof m.authorName !== "string") return false;
  if (typeof m.createdAt !== "string") return false;
  if (!hasValidMessageMetadata(m)) return false;
  switch (m.kind) {
    case "text":
    case "system":
      return typeof m.text === "string";
    case "pick":
      return isFinzPartyPick(m.payload);
    case "summary":
      return isFinzPartySummary(m.payload);
    case "position":
      return isPositionPayload(m.payload);
    case "chart":
      return isChartPayload(m.payload);
    case "portfolio":
      return isFinzPortfolioCardPayload(m.payload);
    default:
      return false;
  }
}

export function isFinzDeletedMessage(message: Pick<FinzChatMessage, "deletedAt">): boolean {
  return typeof message.deletedAt === "string" && message.deletedAt.length > 0;
}

export function finzMessageSnippet(message: FinzChatMessage | FinzStoredChatMessage, max = 64): string {
  if ("deletedAt" in message && message.deletedAt) return "삭제된 메시지입니다";
  let text: string;
  switch (message.kind) {
    case "text":
    case "system":
      text = message.text;
      break;
    case "pick":
      text = `우정주 · ${message.payload.name}`;
      break;
    case "summary":
      text = `요약 · ${message.payload.summary}`;
      break;
    case "position":
      text = `입장 · ${message.payload.stance}${message.payload.note ? " · " + message.payload.note : ""}`;
      break;
    case "chart":
      text = `차트 · ${message.payload.label || message.payload.symbol}`;
      break;
    case "portfolio":
      text = message.payload.view === "sector" ? "섹터 분석" : `포트폴리오 · ${message.payload.scopeLabel}`;
      break;
  }
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(0, max - 1))}…`;
}

export function isFinzNudgeCta(value: unknown): value is FinzNudgeCta {
  return value === "invite" || value === "pick" || value === "position" || value === "summary";
}

// AI 봇 멘션 정규식 — @finz / @핀즈 / @AI / @에이아이.
// 짧은 'ai' 만 라틴 글자 연속(@airline 류)을 lookahead 로 배제. finz/핀즈/에이아이 는 충분히 distinctive 해
// 뒤에 한글 조사가 붙어도(@finz야) 그대로 인식한다.
const FINZ_MENTION = /@\s*(?:finz|핀즈|에이아이|ai(?![a-z]))/i;

// 메시지가 AI 봇을 호출하는지. 호출 시 그라운딩 LLM 이 질문에 답한다.
export function mentionsFinz(text: string): boolean {
  return FINZ_MENTION.test(text);
}

// 멘션 토큰을 떼고 실제 질문만 남긴다(클라이언트가 ask 로 보낼 질문 추출).
export function stripFinzMention(text: string): string {
  return text.replace(new RegExp(FINZ_MENTION.source, "gi"), "").trim();
}

// @finz 멘션의 "의도" — 서버 LLM 분류 결과. 클라이언트가 이걸로 기능을 분기한다.
//  pick=우정주 / summary=AI 요약 / position=내 입장 / chart=종목 차트 / briefing=매일 아침 시황 구독·해지 /
//  schedule=임의의 정기 메시지 등록(매일/매주/N분마다 보내줘) / qa=그 외(기본).
export type FinzMentionIntent =
  | "pick"
  | "summary"
  | "position"
  | "chart"
  | "briefing"
  | "schedule"
  | "portfolio"
  | "qa";
export const FINZ_MENTION_INTENTS: readonly FinzMentionIntent[] = [
  "pick",
  "summary",
  "position",
  "chart",
  "briefing",
  "schedule",
  "portfolio",
  "qa",
] as const;
export function isFinzMentionIntent(value: unknown): value is FinzMentionIntent {
  return (
    value === "pick" ||
    value === "summary" ||
    value === "position" ||
    value === "chart" ||
    value === "briefing" ||
    value === "schedule" ||
    value === "portfolio" ||
    value === "qa"
  );
}

// LLM 이 추출한 종목 심볼(거래소:티커)을 TradingView 가 안전히 받도록 정규화. 허용 외 문자는 제거.
// 형식 불명/빈 값이면 null → 호출부가 chart 대신 qa 로 폴백.
export function normalizeChartSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9:._-]/g, "").slice(0, 24);
  return cleaned.length > 0 ? cleaned : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 텍스트를 멘션/일반 세그먼트로 분해 — finz 봇 멘션(@finz 등)에 더해, names 로 준 멤버 이름(@남덕우 등)도 멘션으로.
// 메시지뷰·입력창 백드롭이 멘션 토큰만 칩으로 하이라이트하는 데 쓴다.
export function splitByMentionTokens(
  text: string,
  names: string[] = [],
): Array<{ text: string; isMention: boolean }> {
  // 멤버 이름: 공백 제거·중복 제거·긴 이름 우선(부분 매칭 방지). 정규식 특수문자 이스케이프.
  const memberNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const memberAlt = memberNames.length > 0 ? `|@\\s*(?:${memberNames.join("|")})` : "";
  const re = new RegExp(`(?:${FINZ_MENTION.source})${memberAlt}`, "gi");

  const out: Array<{ text: string; isMention: boolean }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), isMention: false });
    out.push({ text: m[0], isMention: true });
    last = m.index + m[0].length;
    if (re.lastIndex === m.index) re.lastIndex += 1; // zero-length 매치 안전장치(무한루프 방지)
  }
  if (last < text.length) out.push({ text: text.slice(last), isMention: false });
  return out;
}

// 기존 호출부 호환 — finz 봇 멘션만 하이라이트.
export function splitByMention(text: string): Array<{ text: string; isMention: boolean }> {
  return splitByMentionTokens(text, []);
}

// 메시지가 특정 멤버를 멘션(@표시이름)했는지 — 방 음소거 시 "멘션 예외" 판단용.
// 멤버 멘션 기준(@displayName)은 splitByMentionTokens 와 동일. 빈 이름은 false.
export function mentionsMember(text: string, displayName: string): boolean {
  const name = displayName.trim();
  if (!name) return false;
  return new RegExp(`@\\s*${escapeRegExp(name)}`, "i").test(text);
}

// ── 순수 셀렉터(I/O 없음, 단위 테스트 대상). messages 는 seq 오름차순 가정. ──

export function selectLatestPick(messages: FinzChatMessage[]): FinzChatPickMessage | null {
  let latest: FinzChatPickMessage | null = null;
  for (const m of messages) {
    if (m.kind === "pick" && (latest === null || m.seq > latest.seq)) latest = m;
  }
  return latest;
}

export type LatestPosition = { stance: FinzPartyStance; note: string; authorId: string; seq: number };

// 현재 픽(sincePickSeq) 이후의 포지션만, 멤버별 최신 1개. 옛 픽에 남긴 포지션은 제외(재추첨 시 리셋).
export function selectLatestPositionsByMember(
  messages: FinzChatMessage[],
  sincePickSeq: number,
): Map<string, LatestPosition> {
  const byMember = new Map<string, LatestPosition>();
  for (const m of messages) {
    if (m.deletedAt) continue;
    if (m.kind !== "position" || m.seq <= sincePickSeq) continue;
    const prev = byMember.get(m.authorId);
    if (!prev || m.seq > prev.seq) {
      byMember.set(m.authorId, { stance: m.payload.stance, note: m.payload.note, authorId: m.authorId, seq: m.seq });
    }
  }
  return byMember;
}

function maxSummarySeq(messages: FinzChatMessage[], sincePickSeq: number): number {
  let max = -1;
  for (const m of messages) {
    if (m.kind === "summary" && m.seq > sincePickSeq && m.seq > max) max = m.seq;
  }
  return max;
}

// 마지막 finz 발화 이후 쌓인 멤버 텍스트 수.
export function countMemberMessagesSinceFinz(messages: FinzChatMessage[]): number {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || m.role === "finz") break;
    if (!m.deletedAt && m.role === "member" && m.kind === "text") count += 1;
  }
  return count;
}

// finz 가 스스로 끼어들어야 하나? — 멤버 발화 "직후"에, finz 가 한동안 말 안 했고(threshold 이상),
// 멤버 대화가 충분히 쌓였을 때만. (멘션 답변과 별개의 선제 개입. 빈도는 서버 쿨다운 락이 추가로 제한.)
export function shouldFinzProactivelySpeak(messages: FinzChatMessage[], threshold = 3): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.deletedAt || last.role !== "member" || last.kind !== "text") return false;
  return countMemberMessagesSinceFinz(messages) >= threshold;
}

// @finz 호출(의도 분류 · 그라운딩 답변 · 선제 개입)이 LLM 에 넘길 "대화 맥락" 한 줄.
// speaker 는 서버가 아는 role/멤버에서만 도출 — 사용자 텍스트가 'finz:' 가짜 화자로 위장하지 못한다.
export type FinzTranscriptTurn = { speaker: string; text: string };

// 최근 maxTurns 발화를 speaker/text 로 평탄화한다(seq 오름차순 가정). 비텍스트 메시지(픽·요약·차트·입장)는
// finz/멤버가 한 '행동'을 한 줄로 요약해 흐름을 유지한다. system·portfolio 메시지는 맥락에서 생략한다.
// ask/proactive/intent 가 같은 맥락 뷰를 공유해, 답변하는 finz 와 의도를 분류하는 finz 가 동일한 대화를 본다.
export function buildFinzTranscript(
  messages: FinzChatMessage[],
  members: { memberId: string; displayName: string }[],
  maxTurns = 8,
): FinzTranscriptTurn[] {
  const nameOf = (id: string) => members.find((m) => m.memberId === id)?.displayName ?? "친구";
  const recent = messages.slice(-maxTurns);
  const turns: FinzTranscriptTurn[] = [];
  for (const m of recent) {
    if (m.deletedAt) turns.push({ speaker: m.role === "finz" ? "finz" : nameOf(m.authorId), text: "삭제된 메시지입니다" });
    else if (m.kind === "text") turns.push({ speaker: m.role === "finz" ? "finz" : nameOf(m.authorId), text: m.text });
    else if (m.kind === "pick") turns.push({ speaker: "finz", text: `(우정주 테마 '${m.payload.name}' 를 뽑음)` });
    else if (m.kind === "summary") turns.push({ speaker: "finz", text: `(파티 요약) ${m.payload.summary}` });
    else if (m.kind === "chart") turns.push({ speaker: "finz", text: `(${m.payload.label} 차트를 보여줌)` });
    else if (m.kind === "position")
      turns.push({ speaker: nameOf(m.authorId), text: `(입장) ${m.payload.stance}${m.payload.note ? " · " + m.payload.note : ""}` });
    // system·portfolio 는 생략(기존 ask/proactive 동작 보존)
  }
  return turns;
}

// "이제 뭐 할까" 코칭 — 현재 상태에서 단 하나(또는 없음)를 계산. 비저장. 상태가 진행되면 자연히 사라짐.
export function computeNextNudge(
  messages: FinzChatMessage[],
  members: FinzChatMemberLite[],
  myMemberId: string | null,
): FinzNudge | null {
  if (members.length < 2) {
    return { cta: "invite", text: "친구를 초대하면 둘의 조합으로 우정주를 뽑아줄게." };
  }
  const latestPick = selectLatestPick(messages);
  if (!latestPick) {
    return { cta: "pick", text: "둘 다 모였어! 이 조합의 우정주를 뽑아볼까?" };
  }
  const positions = selectLatestPositionsByMember(messages, latestPick.seq);
  const iPositioned = myMemberId != null && positions.has(myMemberId);
  if (!iPositioned) {
    return { cta: "position", text: "이 테마, 너는 어떻게 봐? 한 줄 입장을 남겨봐." };
  }
  // 나 말고 아직 입장을 안 남긴 멤버가 있으면 — 내가 할 행동이 없으니 코칭 버블을 띄우지 않는다(null).
  // (예전엔 "OO님 입장 기다리는 중" 버블을 띄웠는데, 행동 불가한데 타임라인 맨 아래에 계속 박혀 있어 제거.)
  const someoneMissing = members.some((m) => m.memberId !== myMemberId && !positions.has(m.memberId));
  if (someoneMissing) return null;
  // 모두 포지션 완료 — 이 픽 기준 최신 요약이 최신 포지션보다 뒤면 더 권할 게 없다.
  const latestPositionSeq = Math.max(...[...positions.values()].map((p) => p.seq), latestPick.seq);
  if (maxSummarySeq(messages, latestPick.seq) > latestPositionSeq) return null;
  // 대화가 마지막 입장 이후로 이어졌으면(브리핑·자유 대화 등) '요약 받을까?' 순간은 지난 것 —
  // 코칭 버블을 최하단에 영원히 고정하지 않는다. 모두 막 입장을 마친 직후(마지막 메시지가 그 입장)에만
  // 한 번 뜨고, 대화가 계속되면 사라진다. 요약은 +메뉴·@finz 로 언제든 받을 수 있어 기능 손실 없음.
  const last = messages[messages.length - 1];
  if (last && last.seq > latestPositionSeq) return null;
  return { cta: "summary", text: "다들 입장을 남겼어! AI 요약을 받아볼까?" };
}
