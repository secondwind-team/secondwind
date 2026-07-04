"use client";

import { Download, FileText } from "lucide-react";
import type { FinzAttachment } from "@/lib/common/services/finz-chat";

// 메시지 첨부 렌더 — 이미지는 그리드 썸네일(탭하면 원본), 그 외는 파일 카드(다운로드).
// 비공개 blob 이라 URL 을 직접 쓰지 않고 방 멤버 게이트 프록시(우리 오리진)로만 열람한다. 정렬은 부모 flex-col 을 따른다.

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FinzAttachmentList({
  attachments,
  groupId,
  mine = false,
}: {
  attachments: FinzAttachment[];
  groupId: string;
  mine?: boolean;
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind !== "image");
  const gridN = Math.min(images.length, 4);
  // 게이트 프록시 URL(우리 오리진). 세션·방멤버·방소속 검증 통과 시에만 스트리밍된다.
  const src = (a: FinzAttachment) => `/api/finz/party/${groupId}/attachment?p=${encodeURIComponent(a.pathname)}`;

  return (
    <div className={`fz-attachments ${mine ? "fz-attachments--me" : ""}`}>
      {images.length > 0 && (
        <div className={`fz-attach-grid fz-attach-grid--${gridN}`}>
          {images.map((a, i) => (
            <a
              key={i}
              href={src(a)}
              target="_blank"
              rel="noopener noreferrer"
              className="fz-attach-img"
              aria-label={a.name || "이미지 열기"}
            >
              {/* 게이트 프록시가 스트리밍하는 우리 Blob 썸네일. next/image 대신 지연 로드 <img>. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(a)} alt={a.name} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {files.map((a, i) => (
        <a
          key={i}
          href={src(a)}
          target="_blank"
          rel="noopener noreferrer"
          download={a.name}
          className="fz-attach-file"
        >
          <FileText className="h-5 w-5 shrink-0 text-[var(--fz-coral-ink)]" aria-hidden />
          <span className="fz-attach-file__body">
            <span className="fz-attach-file__name">{a.name || "첨부파일"}</span>
            {formatBytes(a.size) && <span className="fz-attach-file__meta">{formatBytes(a.size)}</span>}
          </span>
          <Download className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </a>
      ))}
    </div>
  );
}
