import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAccount } from "@/lib/server/finz-account";

export const runtime = "nodejs";

// 채팅 첨부(이미지/파일) 업로드용 클라이언트 토큰 발급 라우트. @vercel/blob 의 client upload 패턴:
// 클라이언트가 이 라우트에서 짧은 수명 토큰을 받아 Blob 에 직접 업로드한다(서버리스 본문 4.5MB 제한 우회).
// 토큰 발급은 로그인 계정만(requireAccount) — 서버를 익명 업로드 창구로 악용 못 하게. 타입·용량 상한 강제.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB (finz-chat-store 의 재검증 상한과 정합)
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function POST(request: Request): Promise<Response> {
  // 스토어 미프로비저닝(토큰 없음)이면 명확히 503 — 클라이언트는 "첨부 준비 중" 안내.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "attachments-not-configured" }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const account = await requireAccount();
        if (!account) throw new Error("unauthorized");
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true, // 파일명 충돌·열람 방지
          tokenPayload: JSON.stringify({ accountId: account.accountId }),
        };
      },
      // 후처리 없음. (로컬에선 이 콜백이 오지 않지만 필수 아님 — 클라가 받은 blob URL 을
      //  메시지에 담고, 메시지 저장 시 서버가 Blob 호스트/용량을 다시 검증한다.)
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload-failed";
    return NextResponse.json({ error: message }, { status: message === "unauthorized" ? 401 : 400 });
  }
}
