import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isValidAttachmentPathname } from "@/lib/common/services/finz-chat";
import { requireAccount } from "@/lib/server/finz-account";
import { getFinzGroup, isFinzGroupId } from "@/lib/server/finz-group-store";
import { roomHasAttachment } from "@/lib/server/finz-chat-store";

export const runtime = "nodejs";

// 비공개 첨부 스트리밍 프록시. 게이트 3중: ① 로그인 계정 ② 이 방의 멤버 ③ 이 방에 실제로 올라온 pathname.
// 통과하면 get(pathname,{access:"private"})로 blob 을 스트리밍한다 — 브라우저는 우리 오리진만 보고,
// world-readable blob URL 은 어디에도 노출되지 않는다(채팅 사진 프라이버시).
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isFinzGroupId(groupId)) {
    return NextResponse.json({ status: "error", reason: "invalid-id" }, { status: 400 });
  }

  // pathname 은 반드시 bare path — get() 이 URL 을 받으면 직접 fetch 하므로 스킴/URL 은 거절(SSRF 차단).
  const pathname = new URL(req.url).searchParams.get("p") ?? "";
  if (!isValidAttachmentPathname(pathname)) {
    return NextResponse.json({ status: "error", reason: "invalid-pathname" }, { status: 400 });
  }

  const [account, group] = await Promise.all([requireAccount(), getFinzGroup(groupId)]);
  if (!group) return NextResponse.json({ status: "not-found" }, { status: 404 });
  if (!account || !group.members.some((m) => m.memberId === account.accountId)) {
    return NextResponse.json({ status: "error", reason: "not-member" }, { status: 403 });
  }
  if (!(await roomHasAttachment(groupId, pathname))) {
    return NextResponse.json({ status: "error", reason: "not-in-room" }, { status: 404 });
  }

  let result: Awaited<ReturnType<typeof get>>;
  try {
    result = await get(pathname, { access: "private" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 502 });
  }
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ status: "not-found" }, { status: 404 });
  }

  const contentType = result.blob.contentType || "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": contentType,
    // 불변(업로드 시 랜덤 suffix) → 개인 캐시로만 오래 보관.
    "cache-control": "private, max-age=86400, immutable",
    "x-content-type-options": "nosniff",
  };
  // 이미지만 인라인(=<img> 렌더). 그 외(문서·zip 등)는 강제 다운로드 — 우리 오리진에서 문서가
  // 페이지로 렌더/실행되는 것을 막는다(방어적: 업로드 화이트리스트에 html/svg 는 이미 제외).
  if (!contentType.startsWith("image/")) {
    headers["content-disposition"] = "attachment";
  }

  return new Response(result.stream, { headers });
}
