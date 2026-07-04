"use client";

import { useEffect, useState } from "react";
import type { FinzLinkPreviewData } from "@/lib/server/finz-link-preview";

// 링크 미리보기 카드 — 메시지에 붙은 첫 URL 의 OG 썸네일/제목/설명을 말풍선 아래에 붙인다.
// 값은 서버(/api/finz/link-preview, Upstash 캐시)에서 받아온다. 폴링으로 메시지 뷰가 자주 리렌더되므로
// 모듈 레벨 캐시 + in-flight 디듑으로 같은 URL 은 세션당 한 번만 요청한다. 미리보기가 없으면 아무것도 안 그린다.

type Resolved = FinzLinkPreviewData | null;
const cache = new Map<string, Resolved>();
const inflight = new Map<string, Promise<Resolved>>();

async function loadPreview(url: string): Promise<Resolved> {
  if (cache.has(url)) return cache.get(url)!;
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = (async (): Promise<Resolved> => {
    try {
      const res = await fetch(`/api/finz/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as { status?: string; preview?: FinzLinkPreviewData };
      return json.status === "ok" && json.preview ? json.preview : null;
    } catch {
      return null;
    }
  })();
  inflight.set(url, p);
  const result = await p;
  cache.set(url, result);
  inflight.delete(url);
  return result;
}

export function FinzLinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const [data, setData] = useState<Resolved>(() => cache.get(url) ?? null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let alive = true;
    setImgOk(true);
    if (cache.has(url)) {
      setData(cache.get(url)!);
      return;
    }
    loadPreview(url).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  if (!data) return null;
  const showImg = Boolean(data.image) && imgOk;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fz-link-preview ${mine ? "fz-link-preview--me" : ""}`}
    >
      {showImg && (
        // 외부 임의 도메인 썸네일 — next/image(도메인 화이트리스트 필요) 대신 지연 로드 <img>. 실패 시 숨김.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          className="fz-link-preview__img"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
        />
      )}
      <div className="fz-link-preview__body">
        {data.siteName && <span className="fz-link-preview__site">{data.siteName}</span>}
        {data.title && <span className="fz-link-preview__title">{data.title}</span>}
        {data.description && <span className="fz-link-preview__desc">{data.description}</span>}
      </div>
    </a>
  );
}
