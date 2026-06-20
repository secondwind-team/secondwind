// 서버 전용: "정기 브리핑" 구독 방 목록을 Upstash Redis SET 으로 관리한다.
// 방이 매일 아침 시황(briefingId)을 받을지 opt-in. cron 이 이 SET 을 읽어 구독한 방에만 전송한다.
// (전역 "모든 방" 인덱스는 없다 — 의도적으로 구독한 방만 안다.)

import { getClient } from "./finz-group-store";

// 브리핑 종류 id. 지금은 아침 경제 시황 하나. 새 브리핑은 id 만 추가하면 SET 이 분리된다.
export const MORNING_ECONOMY_BRIEFING_ID = "economy-morning";

function briefingRoomsKey(briefingId: string): string {
  return `sw:finz:briefing:${briefingId}:rooms`;
}

export async function subscribeBriefing(briefingId: string, roomId: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.sadd(briefingRoomsKey(briefingId), roomId);
}

export async function unsubscribeBriefing(briefingId: string, roomId: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.srem(briefingRoomsKey(briefingId), roomId);
}

export async function isBriefingSubscribed(briefingId: string, roomId: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  return (await redis.sismember(briefingRoomsKey(briefingId), roomId)) === 1;
}

// cron 이 전송 대상 방을 읽는다. 유효한 groupId 형식만(SET 오염 방어).
export async function listBriefingRooms(briefingId: string): Promise<string[]> {
  const redis = getClient();
  if (!redis) return [];
  const ids = (await redis.smembers(briefingRoomsKey(briefingId))) as string[];
  return ids.filter((id) => typeof id === "string" && /^[0-9A-Za-z]{6}$/.test(id));
}

// 멱등 락 — 같은 날(KST) 같은 브리핑을 두 번 보내지 않게(GH Actions 재시도·수동+자동 동시 발화 방어).
// SET NX 로 하루치 "전송함" 마커를 잡는다. 성공 시 유지(다음 호출은 스킵), LLM 실패 시 release 로 재시도 허용.
function briefingRunKey(briefingId: string, dateKey: string): string {
  return `sw:finz:briefing:${briefingId}:sent:${dateKey}`;
}
export async function claimBriefingRun(briefingId: string, dateKey: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return true; // 로컬(미설정)은 통과 — prod 은 항상 redis 있음.
  const res = await redis.set(briefingRunKey(briefingId, dateKey), "1", { nx: true, ex: 90000 }); // ~25h
  return res === "OK";
}
export async function releaseBriefingRun(briefingId: string, dateKey: string): Promise<void> {
  const redis = getClient();
  if (redis) await redis.del(briefingRunKey(briefingId, dateKey));
}
