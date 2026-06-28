// FINZ 채팅 시각 표기 — 순수 헬퍼(I/O 없음, 단위 테스트 대상).
// 카카오톡식 타임라인: 하루가 바뀌면 한 번 "yyyy년 M월 D일 (요일)" 구분선, 각 메시지엔 "오전/오후 h:mm".
//
// 타임존은 항상 KST 로 고정한다 — 앱이 한국 사용자 기준이고(브리핑 cron 도 KST), 보는 사람의 기기
// 타임존이 달라도 같은 메시지가 같은 날짜·시각으로 보이게 한다. 날짜 구분선 grouping 과 메시지 시각이
// 같은 TZ 를 써야 경계가 어긋나지 않는다.
//
// KST 는 DST 가 없어 고정 +9h 다 → Intl 로케일 데이터(ICU)에 의존하지 않고 offset 보정 + 직접 라벨링한다
// (브리핑 cron 의 `Date.now()+9h`/getUTC* 와 동일한 결정적 방식 — Node ICU 빌드 차이에 흔들리지 않음).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

type KstParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

// ISO → KST 벽시계 구성요소. 파싱 불가면 null.
function kstParts(iso: string): KstParts | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + KST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(), // 0 = 일요일
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "오전 9:05" / "오후 3:30". 파싱 불가면 빈 문자열(표시 생략).
export function formatKstTime(iso: string): string {
  const p = kstParts(iso);
  if (!p) return "";
  const meridiem = p.hour < 12 ? "오전" : "오후";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${meridiem} ${h12}:${pad2(p.minute)}`;
}

// "2026년 6월 28일 (일)". 날짜 구분선용. 파싱 불가면 빈 문자열.
export function formatKstDate(iso: string): string {
  const p = kstParts(iso);
  if (!p) return "";
  return `${p.year}년 ${p.month}월 ${p.day}일 (${WEEKDAY_KO[p.weekday]})`;
}

// KST 기준 달력 일자 키(YYYY-MM-DD) — 연속 메시지의 day 가 바뀌었는지 비교(구분선 삽입 판단)에 쓴다.
// 파싱 불가면 빈 문자열(호출부가 truthy 가드 → 빈 키끼리는 같은 날로 보지 않음).
export function kstDayKey(iso: string): string {
  const p = kstParts(iso);
  return p ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : "";
}

// 두 ISO 가 같은 KST 날짜인가. 둘 중 하나라도 파싱 불가면 false(보수적으로 구분선 표시).
export function isSameKstDay(a: string, b: string): boolean {
  const ka = kstDayKey(a);
  const kb = kstDayKey(b);
  return ka !== "" && ka === kb;
}
