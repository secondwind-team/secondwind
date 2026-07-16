"use client";

import { FileText, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FinzPartyStance } from "@/lib/common/services/finz";
import {
  FINZ_IMAGE_QUALITY_PRESETS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  splitByMentionTokens,
  type FinzAttachment,
  type FinzAttachmentKind,
  type FinzChatKind,
  type FinzImageQuality,
} from "@/lib/common/services/finz-chat";
import { FinzPositionInput } from "./finz-position-input";

// 첨부 업로드 상한(업로드 라우트·store 재검증과 정합). 클라이언트에서 1차 거른다.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
// 리사이즈될 이미지의 원본 상한(디코드 OOM 방지선). 리사이즈 후 크기는 uploadOne 에서 다시 12MB 로 검사.
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
// HEIC/HEIF 은 브라우저 파일 선택기에서 image/* 로 안 잡히는 경우가 있어 확장자를 명시적으로 추가.
const ATTACH_ACCEPT =
  "image/*,.heic,.heif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

// HEIC/HEIF 판별 — file.type 이 비어 오는 경우가 잦아 확장자도 함께 본다.
function isHeicFile(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}
function isImageFile(file: File): boolean {
  return isHeicFile(file) || file.type.startsWith("image/");
}

// 이미지를 캔버스로 리사이즈해 JPEG 로 재인코딩. 긴 변이 maxLongSide 이하면 스케일 1(품질만 적용).
async function resizeToJpeg(source: Blob, maxLongSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const long = Math.max(bitmap.width, bitmap.height) || 1;
  const scale = long > maxLongSide ? maxLongSide / long : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return source;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return out ?? source;
}

// 업로드 전 이미지 처리 — 방 화질 설정에 따라. original=원본(리사이즈 없음, HEIC 만 JPEG),
// standard=긴 변 1600px, saver=긴 변 1024px. 비이미지는 그대로. heic2any 는 HEIC 일 때만 lazy-load.
async function prepareUpload(
  file: File,
  quality: FinzImageQuality,
): Promise<{ file: File; contentType: string; name: string }> {
  if (!isImageFile(file)) {
    return { file, contentType: file.type || "application/octet-stream", name: file.name };
  }
  const heic = isHeicFile(file);
  let source: Blob = file;
  if (heic) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    source = Array.isArray(converted) ? converted[0]! : converted;
  }
  const base = file.name.replace(/\.[^./\\]+$/, "") || "image";

  if (quality === "original") {
    if (heic) {
      return { file: new File([source], `${base}.jpg`, { type: "image/jpeg" }), contentType: "image/jpeg", name: `${base}.jpg` };
    }
    return { file, contentType: file.type || "image/jpeg", name: file.name };
  }

  const preset = FINZ_IMAGE_QUALITY_PRESETS[quality]; // standard | saver
  const resized = await resizeToJpeg(source, preset.maxLongSide, preset.quality);
  const name = `${base}.jpg`;
  return { file: new File([resized], name, { type: "image/jpeg" }), contentType: "image/jpeg", name };
}

// 컴포저에 잠깐 얹혀 업로드 중/완료를 보여주는 스테이징 첨부.
type StagedAttachment = {
  tempId: string;
  name: string;
  kind: FinzAttachmentKind;
  previewUrl?: string; // 이미지 로컬 미리보기(object URL)
  status: "uploading" | "done" | "error";
  attachment?: FinzAttachment; // 업로드 완료 시 실제 Blob 첨부
};

type ComposerReference = { id: string; authorName: string; snippet: string; kind: FinzChatKind };

// 하단 입력 바(멤버 전용). + 버튼 = 액션 시트(우정주 뽑기 / 내 입장 / 요약), 본문 = 텍스트 전송.
// stance 모드는 부모가 제어(nudge 의 '입장' CTA 도 같은 모드를 연다).
export function FinzChatComposer({
  full,
  hasPick,
  sending,
  pickBusy,
  recapBusy,
  monthlyReviewBusy,
  positionSubmitting,
  myLatestStance,
  myLatestNote,
  stanceMode,
  attachmentsEnabled,
  imageQuality,
  mentionNames,
  replyTarget,
  editingTarget,
  onSetStanceMode,
  onSendText,
  onEditText,
  onCancelReply,
  onCancelEdit,
  onPick,
  onPosition,
  onRecap,
  onMonthlyReview,
}: {
  full: boolean;
  hasPick: boolean;
  sending: boolean;
  pickBusy: boolean;
  recapBusy: boolean;
  monthlyReviewBusy: boolean;
  positionSubmitting: boolean;
  myLatestStance: FinzPartyStance | null;
  myLatestNote: string;
  stanceMode: boolean;
  attachmentsEnabled: boolean; // Blob 스토어 연결 시에만 '사진·파일' 노출
  imageQuality: FinzImageQuality; // 방 이미지 화질(원본/표준/저용량) — 업로드 전 처리 기준
  mentionNames: string[]; // 멤버 이름들(@남덕우 처럼 입력 중 배지 강조용)
  replyTarget: ComposerReference | null;
  editingTarget: (ComposerReference & { text: string }) | null;
  onSetStanceMode: (v: boolean) => void;
  onSendText: (text: string, replyToId?: string, attachments?: FinzAttachment[]) => void;
  onEditText: (text: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onPick: () => void;
  onPosition: (stance: FinzPartyStance, note: string) => void;
  onRecap: () => void;
  onMonthlyReview: () => void;
}) {
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // textarea 가 내부 스크롤되면 백드롭(하이라이트)도 같은 위치로 맞춘다(긴 글 줄바꿈 정렬).
  function syncScroll() {
    const ta = taRef.current;
    const bd = backdropRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  }

  // 시트 열리면 첫 액션에 포커스, Esc 면 + 버튼으로 복귀.
  useEffect(() => {
    if (!sheetOpen) return;
    const first = sheetRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSheetOpen(false);
        plusRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  useEffect(() => {
    if (!editingTarget) return;
    setSheetOpen(false);
    setText(editingTarget.text);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    });
  }, [editingTarget]);

  // ── 첨부(이미지·파일) ── + 메뉴의 '사진·파일'이 숨은 file input 을 연다. 고른 파일은 즉시 업로드해
  // 스테이징 스트립에 썸네일로 얹고, 전송 시 완료된 것만 메시지에 담는다(캡션 text 와 공존).
  function openFilePicker() {
    setAttachError(null);
    fileInputRef.current?.click();
  }

  async function uploadOne(file: File, tempId: string) {
    try {
      // 방 화질 설정에 맞춰 이미지 처리(원본/표준 1600/저용량 1024) + HEIC→JPEG. 비이미지는 그대로.
      const prepared = await prepareUpload(file, imageQuality);
      if (prepared.file.size > MAX_UPLOAD_BYTES) throw new Error("too-big");

      // HEIC 은 addFiles 에서 미리보기를 못 만들었으니(브라우저가 원본을 못 그림) 처리된 JPEG 로 채운다.
      if (isHeicFile(file) && prepared.contentType.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(prepared.file);
        setStaged((s) =>
          s.map((x) => {
            if (x.tempId !== tempId) return x;
            if (x.previewUrl) {
              URL.revokeObjectURL(previewUrl);
              return x;
            }
            return { ...x, previewUrl };
          }),
        );
      }

      // @vercel/blob 클라이언트 SDK 는 첨부를 실제로 고를 때만 로드(초기 채팅 번들에서 제외).
      const { upload } = await import("@vercel/blob/client");
      // access:"private" — world-readable URL 을 만들지 않는다. 열람은 방 멤버 게이트 프록시를 거친다.
      const blob = await upload(prepared.file.name, prepared.file, {
        access: "private",
        handleUploadUrl: "/api/finz/upload",
        contentType: prepared.contentType,
      });
      const kind: FinzAttachmentKind = prepared.contentType.startsWith("image/") ? "image" : "file";
      const attachment: FinzAttachment = {
        kind,
        pathname: blob.pathname, // URL 이 아니라 pathname 저장 — 프록시가 get(pathname,{access:"private"})로 스트리밍
        name: prepared.name,
        size: prepared.file.size,
        contentType: prepared.contentType,
      };
      setStaged((s) => s.map((x) => (x.tempId === tempId ? { ...x, status: "done", attachment } : x)));
    } catch {
      setAttachError("첨부 업로드에 실패했어. 잠시 뒤 다시 시도해줘.");
      setStaged((s) => s.map((x) => (x.tempId === tempId ? { ...x, status: "error" } : x)));
    }
  }

  // 파일 선택·드롭·붙여넣기 공통 진입점.
  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setAttachError(null);
    const room = MAX_ATTACHMENTS_PER_MESSAGE - staged.length;
    if (room <= 0) {
      setAttachError(`첨부는 한 번에 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지야.`);
      return;
    }
    for (const file of files.slice(0, room)) {
      const heic = isHeicFile(file);
      const isImage = heic || file.type.startsWith("image/");
      // 표준/저용량은 리사이즈로 줄어드니 큰 원본도 허용(디코드 OOM 방지선 50MB). 그 외는 업로드 상한 12MB.
      const willResize = isImage && imageQuality !== "original";
      const cap = willResize ? MAX_SOURCE_BYTES : MAX_UPLOAD_BYTES;
      if (file.size > cap) {
        setAttachError(`${file.name} 은(는) 너무 커 (최대 ${willResize ? "50MB" : "12MB"}).`);
        continue;
      }
      const tempId = crypto.randomUUID();
      // HEIC 미리보기는 변환 후 만든다(원본은 브라우저가 못 그림). 일반 이미지는 즉시.
      const previewUrl = isImage && !heic ? URL.createObjectURL(file) : undefined;
      setStaged((s) => [
        ...s,
        { tempId, name: file.name, kind: isImage ? "image" : "file", previewUrl, status: "uploading" },
      ]);
      void uploadOne(file, tempId);
    }
  }

  // 텍스트박스에 이미지 붙여넣기(Cmd/Ctrl+V) → 첨부로. 텍스트 붙여넣기는 그대로 둔다.
  function onPasteIntoInput(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!attachmentsEnabled) return; // 스토어 미연결이면 기본 동작 유지
    const items = e.clipboardData?.items;
    if (!items) return;
    const images: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) images.push(f);
      }
    }
    if (images.length === 0) return; // 이미지가 아니면 일반 텍스트 붙여넣기
    e.preventDefault();
    addFiles(images);
  }

  function removeStaged(tempId: string) {
    setStaged((s) => {
      const item = s.find((x) => x.tempId === tempId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return s.filter((x) => x.tempId !== tempId);
    });
  }

  function clearStaged() {
    setStaged((s) => {
      for (const x of s) if (x.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return [];
    });
  }

  const doneAttachments = staged.filter((s) => s.status === "done" && s.attachment).map((s) => s.attachment!);
  const uploading = staged.some((s) => s.status === "uploading");
  // 편집은 텍스트 전용. 새 전송은 캡션 또는 완료된 첨부 중 하나만 있어도 가능(단, 업로드 진행 중이면 대기).
  const canSend = editingTarget
    ? Boolean(text.trim())
    : !uploading && (Boolean(text.trim()) || doneAttachments.length > 0);

  function send() {
    if (!canSend || sending) return;
    const t = text.trim();
    if (editingTarget) {
      onEditText(t);
    } else {
      onSendText(t, replyTarget?.id, doneAttachments.length > 0 ? doneAttachments : undefined);
      clearStaged();
    }
    setText("");
  }

  function runAction(fn: () => void) {
    setSheetOpen(false);
    fn();
  }

  // + 메뉴 'FINZ에게 물어보기' — 입력창에 "@finz " 를 자동으로 넣고 포커스한다(멘션 질문을 쉽게 시작).
  // 이미 @finz 로 시작하면 그대로, 기존 텍스트가 있으면 앞에 붙인다.
  function askFinz() {
    setSheetOpen(false);
    setText((t) => (/^@\s*finz/i.test(t) ? t : t ? `@finz ${t}` : "@finz "));
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end); // 커서를 끝으로 — 바로 질문을 이어 타이핑
    });
  }

  const pickReason = !full ? "친구가 들어와야 뽑을 수 있어" : hasPick ? "이미 뽑았어 (말풍선에서 다시 뽑기)" : "";
  const positionReason = !hasPick ? "우정주를 먼저 뽑아줘" : "";

  return (
    <div
      className="flex-none border-t border-[var(--fz-line)] bg-[var(--fz-bg)] px-4 pt-2"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {stanceMode ? (
        <div className="py-2">
          <FinzPositionInput
            initialStance={myLatestStance}
            initialNote={myLatestNote}
            submitting={positionSubmitting}
            onSubmit={(s, n) => onPosition(s, n)}
            onCancel={() => onSetStanceMode(false)}
          />
        </div>
      ) : (
        <>
          {sheetOpen && (
            <div ref={sheetRef} role="menu" aria-label="파티 액션" className="mb-2 space-y-1.5 rounded-[var(--fz-r)] border border-[var(--fz-line)] bg-[var(--fz-surface)] p-2 shadow-[var(--fz-shadow-sm)]">
              {attachmentsEnabled && (
                <SheetItem label="🖼 사진·파일" reason="" onClick={() => runAction(openFilePicker)} />
              )}
              <SheetItem label="🤖 FINZ에게 물어보기" reason="" onClick={askFinz} />
              <SheetItem label="🎴 우정주 뽑기" reason={pickReason} busy={pickBusy} onClick={() => runAction(onPick)} />
              <SheetItem
                label="✋ 내 입장 남기기"
                reason={positionReason}
                onClick={() =>
                  runAction(() => onSetStanceMode(true))
                }
              />
              <SheetItem label="📝 대화 요약" reason="" busy={recapBusy} onClick={() => runAction(onRecap)} />
              <SheetItem
                label="📊 월간 투자 리뷰"
                reason=""
                busy={monthlyReviewBusy}
                onClick={() => runAction(onMonthlyReview)}
              />
            </div>
          )}

          {(replyTarget || editingTarget) && (
            <div className="fz-composer-context mb-2">
              <div className="min-w-0">
                <p>{editingTarget ? "수정 중" : "답장 대상 메시지"}</p>
                <span>
                  {(editingTarget ?? replyTarget)?.authorName}
                  {" · "}
                  {(editingTarget ?? replyTarget)?.snippet}
                </span>
              </div>
              <button
                type="button"
                aria-label={editingTarget ? "수정 취소" : "답장 취소"}
                onClick={() => {
                  if (editingTarget) setText("");
                  editingTarget ? onCancelEdit() : onCancelReply();
                }}
                className="fz-btn fz-btn--ghost h-8 w-8 shrink-0"
                style={{ padding: 0 }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {/* 숨은 파일 입력 — + 메뉴 '사진·파일'이 연다. 다중 선택. 같은 파일 재선택 가능하게 value 초기화. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          {attachError && <p className="fz-alert mb-2">{attachError}</p>}

          {staged.length > 0 && (
            <div className="fz-staged mb-2">
              {staged.map((s) => (
                <div key={s.tempId} className={`fz-staged__item ${s.status === "error" ? "fz-staged__item--error" : ""}`}>
                  {s.kind === "image" && s.previewUrl ? (
                    // 로컬 미리보기(object URL) — 업로드 완료 여부와 무관하게 즉시 보임.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt={s.name} className="fz-staged__thumb" />
                  ) : (
                    <span className="fz-staged__file">
                      <FileText className="h-6 w-6" aria-hidden />
                    </span>
                  )}
                  {s.status === "uploading" && (
                    <span className="fz-staged__overlay" aria-label="업로드 중">
                      <span className="fz-typing">
                        <i />
                        <i />
                        <i />
                      </span>
                    </span>
                  )}
                  {s.status === "error" && <span className="fz-staged__overlay fz-staged__overlay--error">!</span>}
                  <button
                    type="button"
                    onClick={() => removeStaged(s.tempId)}
                    aria-label={`${s.name} 첨부 제거`}
                    className="fz-staged__remove"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 pb-1">
            <button
              ref={plusRef}
              type="button"
              aria-label={sheetOpen ? "액션 닫기" : "파티 액션 열기"}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((v) => !v)}
              disabled={Boolean(editingTarget)}
              className="fz-btn fz-btn--ghost h-11 w-11 shrink-0"
              style={{ padding: 0 }}
            >
              {sheetOpen ? <X className="h-6 w-6 shrink-0" aria-hidden /> : <Plus className="h-6 w-6 shrink-0" aria-hidden />}
            </button>

            {/* 멘션 하이라이트 오버레이: 타이핑 중에도 @finz 가 배지처럼 보이게.
                백드롭(아래)이 스타일된 텍스트를 그리고, 위 textarea 는 글자/배경 투명 + 캐럿만 보이게 겹친다.
                글자 폭을 바꾸지 않는 .fz-mention-live 라 캐럿이 정확히 정렬된다(한글 IME 안전 — 진짜 textarea 유지). */}
            <div className="relative flex-1">
              <div
                ref={backdropRef}
                aria-hidden
                className="fz-input pointer-events-none absolute inset-0 max-h-28 overflow-hidden whitespace-pre-wrap break-words py-2.5 text-[var(--fz-ink)]"
                style={{ borderColor: "transparent" }}
              >
                {splitByMentionTokens(text, mentionNames).map((seg, i) =>
                  seg.isMention ? (
                    <span key={i} className="fz-mention-live">
                      {seg.text}
                    </span>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
                {/* 줄바꿈으로 끝나면 마지막 빈 줄 높이를 유지(스크롤 정렬). */}
                {text.endsWith("\n") ? " " : ""}
              </div>
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={syncScroll}
                onPaste={onPasteIntoInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="메시지 보내기 · @finz 로 질문"
                className="fz-input relative max-h-28 min-h-11 w-full resize-none py-2.5"
                style={{ background: "transparent", color: "transparent", caretColor: "var(--fz-ink)" }}
              />
            </div>

            <button
              type="button"
              onClick={send}
              disabled={!canSend || sending}
              aria-label="보내기"
              className="fz-btn h-11 w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: 0 }}
            >
              <Send className="h-6 w-6 shrink-0" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SheetItem({ label, reason, busy, onClick }: { label: string; reason: string; busy?: boolean; onClick: () => void }) {
  const disabled = Boolean(reason) || Boolean(busy);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[var(--fz-r-sm)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--fz-ink)] transition hover:bg-[var(--fz-surface-2)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {busy && <Sparkles className="h-3.5 w-3.5 animate-pulse text-[var(--fz-coral)]" aria-hidden />}
      </span>
      {reason && <span className="text-xs font-normal text-[var(--fz-muted)]">{reason}</span>}
    </button>
  );
}
