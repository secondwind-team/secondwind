import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireAccount } from "@/lib/server/finz-account";
import { getClient } from "@/lib/server/finz-group-store";
import { fetchLinkPreview, type FinzLinkPreviewData } from "@/lib/server/finz-link-preview";

export const runtime = "nodejs";

// 링크 미리보기(OG 메타) 프록시. 로그인 계정만 호출 가능(서버를 익명 SSRF 프록시로 악용 방지).
// 결과는 Upstash 에 캐시(성공 7일 / 실패 1일) — 같은 URL 을 여러 사람이 봐도 원 서버엔 한 번만 요청.
const CACHE_TTL_OK = 7 * 24 * 60 * 60;
const CACHE_TTL_MISS = 24 * 60 * 60;
const MAX_URL_LENGTH = 2048;

type Cached = { ok: true; data: FinzLinkPreviewData } | { ok: false };

function cacheKey(url: string): string {
  return `sw:finz:linkpreview:v1:${createHash("sha256").update(url).digest("hex")}`;
}

// Upstash 는 auto-deserialization 설정에 따라 문자열 또는 객체를 돌려줄 수 있어 양쪽 다 받는다
// (finz-group-store 의 JSON.stringify + parse 패턴과 동일).
function parseCached(raw: unknown): Cached | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.ok === true && o.data && typeof o.data === "object") return { ok: true, data: o.data as FinzLinkPreviewData };
  if (o.ok === false) return { ok: false };
  return null;
}

export async function GET(req: Request) {
  const account = await requireAccount();
  if (!account) return NextResponse.json({ status: "error", reason: "unauthorized" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("url") ?? "";
  if (!raw || raw.length > MAX_URL_LENGTH) {
    return NextResponse.json({ status: "error", reason: "invalid-url" }, { status: 400 });
  }
  let normalized: string;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme");
    normalized = u.toString();
  } catch {
    return NextResponse.json({ status: "error", reason: "invalid-url" }, { status: 400 });
  }

  const redis = getClient();
  const key = cacheKey(normalized);

  if (redis) {
    try {
      const hit = parseCached(await redis.get(key));
      if (hit) {
        return hit.ok
          ? NextResponse.json({ status: "ok", preview: hit.data })
          : NextResponse.json({ status: "none" });
      }
    } catch {
      // 캐시 조회 실패 → 그냥 fetch 로 진행
    }
  }

  const data = await fetchLinkPreview(normalized);

  if (redis) {
    const value: Cached = data ? { ok: true, data } : { ok: false };
    await redis.set(key, JSON.stringify(value), { ex: data ? CACHE_TTL_OK : CACHE_TTL_MISS }).catch(() => {});
  }

  return data
    ? NextResponse.json({ status: "ok", preview: data })
    : NextResponse.json({ status: "none" });
}
