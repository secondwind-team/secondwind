// 서버 전용: 채팅 메시지에 붙은 URL 의 링크 미리보기(OG 메타데이터)를 안전하게 가져온다.
// 임의의 사용자 입력 URL 을 서버가 fetch 하므로 SSRF 방어가 핵심이다:
//  - http/https 만 허용
//  - 호스트가 사설/루프백/링크로컬 IP 로 해석되면 거부(클라우드 메타데이터 169.254.169.254 포함)
//  - 리다이렉트를 수동으로 따라가며 매 홉의 호스트를 재검증(리다이렉트 기반 SSRF 차단)
//  - 타임아웃 + 응답 크기 상한 + text/html 만 파싱
// 파싱은 정규식으로 <head> 의 og:* / twitter:* / <title> 만 뽑는다(HTML 실행·DOM 없음 → 인젝션 표면 0).

import dns from "node:dns/promises";
import net from "node:net";

export type FinzLinkPreviewData = {
  url: string; // 최종(리다이렉트 후) URL
  title: string;
  description: string;
  image: string; // 절대 http(s) URL, 없으면 ""
  siteName: string;
};

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024; // <head> 는 앞부분에 있어 이 정도면 충분
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (compatible; finz-linkbot/1.0; +https://secondwind-mu.vercel.app)";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!/^\d{1,3}$/.test(p) || !Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // 파싱 불가 → 안전하게 사설 취급
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // this-network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local(클라우드 메타데이터 포함)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmark
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const a = ip.toLowerCase().replace(/%.*$/, ""); // zone id 제거
  if (a === "::1" || a === "::") return true;
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(a);
  if (mapped) return isPrivateIPv4(mapped[1]!);
  const first = a.split(":")[0] ?? "";
  const h = parseInt(first || "0", 16);
  if (Number.isNaN(h)) return true;
  if ((h & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((h & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

// 호스트가 공개(fetch 허용) 대상인지. IP 리터럴은 즉시 판정, 도메인은 DNS 해석 후 모든 주소를 검사.
async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, ""); // [::1] 형태의 대괄호 제거
  const ver = net.isIP(host);
  if (ver === 4) return !isPrivateIPv4(host);
  if (ver === 6) return !isPrivateIPv6(host);

  const lower = host.toLowerCase();
  if (lower === "localhost" || /\.(localhost|local|internal|localdomain)$/.test(lower)) return false;

  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    return false;
  }
  if (addrs.length === 0) return false;
  for (const a of addrs) {
    if (a.family === 4 && isPrivateIPv4(a.address)) return false;
    if (a.family === 6 && isPrivateIPv6(a.address)) return false;
  }
  return true;
}

// 리다이렉트를 수동으로 따라가며 매 홉의 프로토콜/호스트를 재검증한다.
async function safeFetch(startUrl: string): Promise<{ res: Response; finalUrl: string } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!(await isPublicHost(parsed.hostname))) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ko,en;q=0.8",
        },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        current = new URL(loc, current).toString();
      } catch {
        return null;
      }
      continue; // 루프 상단에서 새 호스트 재검증
    }
    return { res, finalUrl: current };
  }
  return null; // 리다이렉트 과다
}

// 응답 본문을 최대 maxBytes 까지만 읽는다(대용량 페이지 방어). 초과 시 조기 취소.
async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (received >= maxBytes) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
  } catch {
    return "";
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&"); // amp 는 마지막(이중 디코드 방지)
}

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return "";
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

// <meta property|name="key" content="..."> — 속성 순서 양쪽 모두 대응.
function pickMeta(html: string, keys: string[]): string {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const a of ["property", "name"]) {
      const re1 = new RegExp(`<meta\\b[^>]*\\b${a}=["']${k}["'][^>]*\\bcontent=["']([^"']*)["']`, "i");
      const m1 = re1.exec(html);
      if (m1 && m1[1]) return m1[1];
      const re2 = new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b${a}=["']${k}["']`, "i");
      const m2 = re2.exec(html);
      if (m2 && m2[1]) return m2[1];
    }
  }
  return "";
}

function pickTitleTag(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1]! : "";
}

const clean = (s: string, max: number) => decodeEntities(s).replace(/\s+/g, " ").trim().slice(0, max);

// URL 하나의 링크 미리보기. 실패/미달이면 null(호출부는 아무것도 렌더하지 않음).
export async function fetchLinkPreview(rawUrl: string): Promise<FinzLinkPreviewData | null> {
  let startUrl: string;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    startUrl = u.toString();
  } catch {
    return null;
  }

  const fetched = await safeFetch(startUrl);
  if (!fetched || !fetched.res.ok) return null;
  const { res, finalUrl } = fetched;

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return null;

  const html = await readCappedText(res, MAX_HTML_BYTES);
  if (!html) return null;

  const title = clean(pickMeta(html, ["og:title", "twitter:title"]) || pickTitleTag(html), 140);
  const description = clean(pickMeta(html, ["og:description", "twitter:description", "description"]), 300);
  const siteName =
    clean(pickMeta(html, ["og:site_name"]), 80) || new URL(finalUrl).hostname.replace(/^www\./, "");

  let image = pickMeta(html, ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src"]);
  if (image) {
    try {
      image = new URL(decodeEntities(image).trim(), finalUrl).toString();
    } catch {
      image = "";
    }
    if (image && !/^https?:\/\//i.test(image)) image = "";
  }

  if (!title && !image) return null; // 보여줄 게 없으면 카드 생략
  return { url: finalUrl, title, description, image, siteName };
}
