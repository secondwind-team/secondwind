// 클라이언트 전용: 로그인 없이 파티 멤버 신원을 localStorage 로 유지한다.
// 전역 finz.memberId 를 한 번 만들어 모든 파티에서 재사용하고, 파티별 힌트로 "내가 이 파티의 멤버"임을 기억한다.
// (memberId 는 위조 가능한 클라이언트 값 — MVP-03 은 join 이후 멤버별 쓰기가 없어 영향이 거의 없다.)

const GLOBAL_KEY = "finz.memberId";

function partyKey(groupId: string): string {
  return `finz.party.${groupId}.memberId`;
}

export function getOrCreateMemberId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(GLOBAL_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(GLOBAL_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function rememberPartyMembership(groupId: string, memberId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(partyKey(groupId), memberId);
  } catch {
    // localStorage 비활성(시크릿 모드 등) — 무시. 같은 세션에선 메모리 상태로 동작.
  }
}

export function getRememberedMemberId(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(partyKey(groupId)) ?? window.localStorage.getItem(GLOBAL_KEY);
  } catch {
    return null;
  }
}
