// 여행 계획을 RFC 5545 iCalendar(.ics) 텍스트로 변환.
// 각 day 의 item 중 time 이 있는 것만 VEVENT 로 변환 (시간 없는 활동은 캘린더에서 의미 약함).
// floating time 사용 — TZID 없이 "20260501T100000" 식. 대부분 캘린더 client 가 import 시 local time 으로 처리.

import type { TravelInput, TravelItem, TravelPlan } from "./travel";

const DEFAULT_DURATION_MIN = 60;
const PRODID = "-//secondwind//travel//KO";
const CRLF = "\r\n";

export function generateIcs(plan: TravelPlan, input: TravelInput, now: Date = new Date()): string {
  const dtstamp = formatUtc(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`${input.destination} 여행`)}`,
  ];

  plan.days.forEach((day, dayIdx) => {
    const dayDate = dateForDay(input.startDate, dayIdx);
    if (!dayDate) return;
    day.items.forEach((item, itemIdx) => {
      const time = parseHm(item.time);
      if (!time) return;
      const start = `${dayDate}T${time}`;
      const end = addMinutes(dayDate, time, DEFAULT_DURATION_MIN);
      const uid = uidFor(plan, dayIdx, itemIdx);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      lines.push(`SUMMARY:${escapeText(buildSummary(item))}`);
      const location = item.place?.address || item.place?.name;
      if (location) lines.push(`LOCATION:${escapeText(location)}`);
      const description = buildDescription(item);
      if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
      lines.push("END:VEVENT");
    });
  });

  lines.push("END:VCALENDAR");
  return lines.join(CRLF);
}

function buildSummary(item: TravelItem): string {
  const placeName = item.place?.name ?? item.place_query;
  if (placeName && !item.text.includes(placeName)) {
    return `${item.text} (${placeName})`;
  }
  return item.text;
}

function buildDescription(item: TravelItem): string {
  const parts: string[] = [];
  if (item.recommended_menu) parts.push(`추천: ${item.recommended_menu}`);
  if (typeof item.cost_krw === "number" && item.cost_krw > 0) {
    parts.push(`예상 비용: ${item.cost_krw.toLocaleString("ko-KR")}원${item.cost_label ? ` (${item.cost_label})` : ""}`);
  }
  if (item.transit) {
    const cost = typeof item.transit.cost_krw === "number" && item.transit.cost_krw > 0
      ? ` · ${item.transit.cost_krw.toLocaleString("ko-KR")}원`
      : "";
    parts.push(`이동: ${item.transit.mode} · ${item.transit.duration_min}분${cost}`);
  }
  if (item.place_warning) parts.push(item.place_warning);
  return parts.join("\n");
}

// "2026-05-01" + dayOffset → "20260501". Date 산술은 UTC 기준으로 — local DST 영향 회피.
export function dateForDay(startDate: string, dayIndex: number): string | undefined {
  const m = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d) + dayIndex));
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseHm(time: string | undefined): string | undefined {
  if (!time) return undefined;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined;
  return `${pad2(h)}${pad2(min)}00`;
}

function addMinutes(date: string, hm: string, addMin: number): string {
  // date: YYYYMMDD, hm: HHMMSS
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const h = Number(hm.slice(0, 2));
  const mi = Number(hm.slice(2, 4));
  const dt = new Date(Date.UTC(y, m - 1, d, h, mi + addMin));
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}00`;
}

function formatUtc(d: Date): string {
  const iso = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return iso; // 20260429T123456Z
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// RFC 5545 §3.3.11 — backslash, semicolon, comma, newline escape.
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// 안정적 UID — 같은 plan + 같은 item 위치는 같은 UID. 캘린더 client 가 재import 시 update 처리.
function uidFor(plan: TravelPlan, dayIdx: number, itemIdx: number): string {
  const seed = `${plan.rationale}|${plan.days[dayIdx]?.label ?? dayIdx}|${itemIdx}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
  return `${(hash >>> 0).toString(36)}-${dayIdx}-${itemIdx}@secondwind`;
}

export function buildIcsFilename(input: TravelInput): string {
  const trimmed = input.destination.trim();
  const safe = trimmed.replace(/[\\/:*?"<>|\s]/g, "-").slice(0, 40);
  const dest = safe || "travel";
  return `${dest}-${input.startDate}.ics`;
}
