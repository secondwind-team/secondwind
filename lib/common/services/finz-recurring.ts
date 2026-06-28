// FINZ 정기 메시지(recurring) — 클라이언트/서버 공용 순수 모델(I/O 없음, 단위 테스트 대상).
//
// 방마다 "정기 메시지"를 등록하면 지정한 주기/시각에 finz 가 그 메시지를 채팅방에 보낸다.
//  - contentKind "text": 고정 문구를 그대로 발송(예: "물 마시기").
//  - contentKind "ai":   저장된 프롬프트를 발송 시점에 LLM 으로 생성(예: "오늘의 명언", "오늘 날씨").
//  - freq "daily"/"weekly": KST hour:minute(weekly 는 weekday)에. "interval": intervalMinutes 마다.
//
// 실제 발송은 ~10분 간격 GitHub Actions cron → /api/finz/cron/recurring 이 due(nextRunAt<=now)를 처리한다.
// 그래서 시각은 분 단위가 아니라 ~10분 버킷 정밀도다(친구 채팅엔 충분). 모든 시각 계산은 KST 고정.

// text=고정 문구 / ai=실행시점 LLM 생성 / chart=종목 차트(content 에 TradingView 심볼 저장, 매번 차트 메시지).
export type FinzRecurringContentKind = "text" | "ai" | "chart";
export type FinzRecurringFreq = "daily" | "weekly" | "interval";

export type FinzRecurringMessage = {
  id: string; // crypto.randomUUID()
  roomId: string;
  createdBy: string; // memberId(=accountId)
  contentKind: FinzRecurringContentKind;
  content: string; // text=발송 문구, ai=생성 프롬프트/주제
  freq: FinzRecurringFreq;
  hour: number; // 0-23 (daily/weekly)
  minute: number; // 0-59 (daily/weekly)
  weekday: number; // 0-6, 0=일 (weekly)
  intervalMinutes: number; // interval 전용(그 외 0)
  enabled: boolean;
  createdAt: string; // ISO
  nextRunAt: number; // ms epoch — 다음 발송 예정
  lastRunAt: number; // ms epoch, 0 = 아직 발송 안 함
};

export const RECURRING_CONTENT_MAX = 200;
export const MIN_INTERVAL_MINUTES = 30; // 스케줄러 ~10분 버킷 + 스팸 방지
export const MAX_INTERVAL_MINUTES = 24 * 60;
export const MAX_RECURRING_PER_ROOM = 10;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 정규화된 생성 입력(구조화 폼 + LLM 추출 공용). 저장 전 라우트가 id/시간 필드를 채운다.
export type NormalizedRecurring = {
  contentKind: FinzRecurringContentKind;
  content: string;
  freq: FinzRecurringFreq;
  hour: number;
  minute: number;
  weekday: number;
  intervalMinutes: number;
};

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

// 구조화 입력(폼/LLM 추출)을 검증·정규화. 내용 없음/주기 불명/시각 범위 밖이면 null(호출부가 안내 폴백).
export function normalizeRecurringInput(raw: unknown): NormalizedRecurring | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  let content = typeof r.content === "string" ? r.content.trim().slice(0, RECURRING_CONTENT_MAX) : "";
  if (!content) return null;

  const contentKind: FinzRecurringContentKind =
    r.contentKind === "ai" ? "ai" : r.contentKind === "chart" ? "chart" : "text";
  // chart 면 content 는 TradingView 심볼(거래소:티커). 영문 심볼로 정리, 비면 무효.
  if (contentKind === "chart") {
    content = content.toUpperCase().replace(/[^A-Z0-9:._-]/g, "").slice(0, 24);
    if (!content) return null;
  }

  if (r.freq !== "daily" && r.freq !== "weekly" && r.freq !== "interval") return null;
  const freq = r.freq;

  if (freq === "interval") {
    const iv = toInt(r.intervalMinutes);
    if (iv === null || iv <= 0) return null;
    return {
      contentKind,
      content,
      freq,
      hour: 0,
      minute: 0,
      weekday: 0,
      intervalMinutes: clamp(iv, MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES),
    };
  }

  const hour = toInt(r.hour);
  if (hour === null || hour < 0 || hour > 23) return null; // 시각은 필수
  const minute = clamp(toInt(r.minute) ?? 0, 0, 59);

  let weekday = 0;
  if (freq === "weekly") {
    const wd = toInt(r.weekday);
    if (wd === null || wd < 0 || wd > 6) return null;
    weekday = wd;
  }

  return { contentKind, content, freq, hour, minute, weekday, intervalMinutes: 0 };
}

// KST 자정(dayOffset 일 가감)의 UTC ms.
function kstDayStartMs(fromMs: number, dayOffset: number): number {
  const kst = new Date(fromMs + KST_OFFSET_MS);
  kst.setUTCHours(0, 0, 0, 0);
  kst.setUTCDate(kst.getUTCDate() + dayOffset);
  return kst.getTime() - KST_OFFSET_MS;
}

function kstWeekday(fromMs: number): number {
  return new Date(fromMs + KST_OFFSET_MS).getUTCDay();
}

// fromMs 이후 다음 발송 시각(ms). 등록 직후·매 발송 후 호출해 nextRunAt 을 전진시킨다.
export function computeNextRun(
  def: Pick<FinzRecurringMessage, "freq" | "hour" | "minute" | "weekday" | "intervalMinutes">,
  fromMs: number,
): number {
  if (def.freq === "interval") {
    return fromMs + Math.max(def.intervalMinutes, 1) * 60_000;
  }
  const timeMs = (def.hour * 60 + def.minute) * 60_000;
  if (def.freq === "daily") {
    const today = kstDayStartMs(fromMs, 0) + timeMs;
    return today > fromMs ? today : kstDayStartMs(fromMs, 1) + timeMs;
  }
  // weekly
  const delta = (def.weekday - kstWeekday(fromMs) + 7) % 7;
  const cand = kstDayStartMs(fromMs, delta) + timeMs;
  return cand > fromMs ? cand : kstDayStartMs(fromMs, delta + 7) + timeMs;
}

function ampmTime(hour: number, minute: number): string {
  const meridiem = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${h12}:${minute < 10 ? `0${minute}` : minute}`;
}

// 사용자에게 보여줄 주기 라벨 — "매일 오전 9:00" / "매주 월요일 오전 9:00" / "30분마다" / "2시간마다".
export function formatRecurringSchedule(
  def: Pick<FinzRecurringMessage, "freq" | "hour" | "minute" | "weekday" | "intervalMinutes">,
): string {
  if (def.freq === "interval") {
    const n = def.intervalMinutes;
    return n % 60 === 0 ? `${n / 60}시간마다` : `${n}분마다`;
  }
  if (def.freq === "weekly") return `매주 ${WEEKDAY_KO[def.weekday] ?? "?"}요일 ${ampmTime(def.hour, def.minute)}`;
  return `매일 ${ampmTime(def.hour, def.minute)}`;
}

// 확인/목록용 한 줄 설명 — "매일 오전 9:00에 '물 마시기'".
export function describeRecurring(
  def: Pick<FinzRecurringMessage, "freq" | "hour" | "minute" | "weekday" | "intervalMinutes" | "contentKind" | "content">,
): string {
  const what =
    def.contentKind === "ai"
      ? `'${def.content}' (AI 생성)`
      : def.contentKind === "chart"
        ? `${def.content} 차트`
        : `'${def.content}'`;
  return `${formatRecurringSchedule(def)}에 ${what}`;
}

// KV 에서 읽은 값 검증(신뢰 안 함). 깨진 정의는 드롭.
export function isFinzRecurringMessage(value: unknown): value is FinzRecurringMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.roomId === "string" &&
    typeof m.createdBy === "string" &&
    (m.contentKind === "text" || m.contentKind === "ai") &&
    typeof m.content === "string" &&
    (m.freq === "daily" || m.freq === "weekly" || m.freq === "interval") &&
    typeof m.hour === "number" &&
    typeof m.minute === "number" &&
    typeof m.weekday === "number" &&
    typeof m.intervalMinutes === "number" &&
    typeof m.enabled === "boolean" &&
    typeof m.createdAt === "string" &&
    typeof m.nextRunAt === "number" &&
    typeof m.lastRunAt === "number"
  );
}
