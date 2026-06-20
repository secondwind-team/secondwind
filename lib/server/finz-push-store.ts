// 서버 전용: FINZ Web Push 구독을 Neon 에 영구 저장하고 web-push 로 발송한다.
// finz-account-store.ts 의 지연 스키마(CREATE TABLE IF NOT EXISTS) 패턴을 그대로 따른다 —
// 별도 마이그레이션 의식 없음. 구독/발송은 "누구의 어떤 기기로 알림을 보내는가"의 계층이라
// 소셜 신원(account-store)과 분리한다(관심사 분리 + 작은 PR).
//
// 구독은 기기+브라우저당 1개(endpoint = 자연키 PK). 한 계정이 여러 기기를 쓰면 여러 행.
// 발송 시 410 Gone / 404 (구독 만료)면 해당 행을 정리한다. 그 외(429/5xx)는 일시 장애로 유지.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import webpush from "web-push";

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;
let vapidReady = false;

// 알림 payload — sw.js 가 받아 showNotification 에 매핑한다(title/body/icon/data.url).
export type FinzPushPayload = {
  title: string;
  body: string;
  url?: string; // notificationclick 시 이동할 경로(기본 /finz)
  tag?: string; // 같은 tag 알림은 OS 가 합친다(중복 방지)
};

// DATABASE_URL(구독 저장) + VAPID 3종(발송 서명) 모두 있어야 푸시가 동작.
// 하나라도 없으면 발송은 no-op, subscribe 는 503 — 기존 store 들의 "미설정이면 통과" 패턴과 정합.
export function isFinzPushConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function getSql() {
  if (client) return client;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  client = neon(databaseUrl);
  return client;
}

// web-push 에 VAPID 키를 1회 주입(모듈 수명 동안 유지). 발송 직전에만 필요.
function ensureVapid() {
  if (vapidReady) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}

async function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          endpoint TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS push_subs_account_idx ON push_subscriptions (account_id)
      `;
    })();
  }
  return schemaReady;
}

// 구독 저장 — 재구독 시 endpoint 기준 upsert(같은 기기 중복행 방지, last_seen 갱신).
export async function upsertSubscription(input: {
  accountId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getSql()`
    INSERT INTO push_subscriptions (endpoint, account_id, p256dh, auth, user_agent, last_seen)
    VALUES (${input.endpoint}, ${input.accountId}, ${input.p256dh}, ${input.auth}, ${input.userAgent ?? null}, NOW())
    ON CONFLICT (endpoint) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      last_seen = NOW()
  `;
}

// 구독 해제 — 본인(account_id 일치) endpoint 만 삭제(타인 구독 삭제 방지).
export async function deleteSubscription(endpoint: string, accountId: string): Promise<void> {
  await ensureSchema();
  await getSql()`
    DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND account_id = ${accountId}
  `;
}

type SubRow = { endpoint: string; p256dh: string; auth: string };

async function listByAccounts(accountIds: string[]): Promise<SubRow[]> {
  if (accountIds.length === 0) return [];
  await ensureSchema();
  const rows = await getSql()`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = ANY(${accountIds})
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    endpoint: r.endpoint as string,
    p256dh: r.p256dh as string,
    auth: r.auth as string,
  }));
}

// 여러 계정의 모든 기기로 푸시 발송. 만료(410/404) 구독은 정리.
// best-effort 전제 — 호출부는 결과를 무시해도 되고(이벤트 fan-out), 실패가 다른 기기 발송을 막지 않는다.
export async function sendToAccounts(
  accountIds: string[],
  payload: FinzPushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!isFinzPushConfigured()) return { sent: 0, pruned: 0 };
  const ids = [...new Set(accountIds)].filter(Boolean);
  const subs = await listByAccounts(ids);
  if (subs.length === 0) return { sent: 0, pruned: 0 };
  ensureVapid();
  const body = JSON.stringify(payload);

  // 기기별 격리 — 한 endpoint 실패가 루프를 멈추지 않게 allSettled.
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body),
    ),
  );

  let sent = 0;
  const expired: string[] = [];
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      sent += 1;
      return;
    }
    // web-push 의 WebPushError 는 .statusCode(.status 아님). 410/404 만 만료로 간주해 정리.
    const statusCode = (res.reason as { statusCode?: number } | undefined)?.statusCode;
    const sub = subs[i];
    if (sub && (statusCode === 410 || statusCode === 404)) expired.push(sub.endpoint);
  });

  let pruned = 0;
  if (expired.length > 0) {
    try {
      await getSql()`DELETE FROM push_subscriptions WHERE endpoint = ANY(${expired})`;
      pruned = expired.length;
    } catch {
      // 정리 실패는 무해 — 다음 발송에서 다시 410 을 받아 재시도된다.
    }
  }
  return { sent, pruned };
}
