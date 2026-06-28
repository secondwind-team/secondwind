import { NextResponse } from "next/server";
import { callLlm } from "@/lib/common/llm";
import { appendAnswerMessage } from "@/lib/server/finz-chat-store";
import {
  MORNING_ECONOMY_BRIEFING_ID,
  claimBriefingRun,
  listBriefingRooms,
  releaseBriefingRun,
  unsubscribeBriefing,
} from "@/lib/server/finz-briefing-store";
import { getBlockedModels, recordCall, recordLlmQuota } from "@/lib/server/quota-store";
import { getFinzGroup } from "@/lib/server/finz-group-store";
import { isFinzPushConfigured, sendToAccounts } from "@/lib/server/finz-push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 정기 브리핑 cron — GitHub Actions(매일 09:00 KST = 0:00 UTC)가 Bearer 토큰으로 호출한다.
// 그라운딩 LLM 으로 오늘의 경제 시황을 1회 생성(방 수와 무관하게 1콜) → 구독한 방에 finz 메시지로 전송.
// 공개로 막 트리거되지 않게 CRON_SECRET 검증. 구독자 0이면 LLM 호출 없이 조기 종료(쿼터 절약).
//
// CRON_SECRET 은 Vercel 환경변수 + GitHub 레포 Secret 양쪽에 설정해야 한다(수동).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[finz/cron/briefing] CRON_SECRET 미설정 — 비활성");
    return NextResponse.json({ status: "error", reason: "unconfigured" }, { status: 503 });
  }
  // Vercel Cron 도 동일 헤더(Authorization: Bearer <CRON_SECRET>)를 보내므로 두 트리거 모두 호환.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", reason: "unauthorized" }, { status: 401 });
  }

  const rooms = await listBriefingRooms(MORNING_ECONOMY_BRIEFING_ID);
  if (rooms.length === 0) {
    return NextResponse.json({ status: "ok", posted: 0, reason: "no-subscribers" });
  }

  // 멱등: 오늘(KST) 이미 보냈으면 스킵(중복 발화·중복 LLM 방어). LLM 실패 시 아래에서 release 해 재시도 허용.
  const dateKey = kstDateKey();
  const claimed = await claimBriefingRun(MORNING_ECONOMY_BRIEFING_ID, dateKey);
  if (!claimed) {
    return NextResponse.json({ status: "ok", posted: 0, reason: "already-sent" });
  }

  // 시황 1회 생성(그라운딩 = 실시간 사실 + 출처). 면책은 서버 불변식으로 부착.
  const skipModels = await getBlockedModels();
  const result = await callLlm(
    { system: BRIEFING_SYSTEM_PROMPT, user: BRIEFING_USER_PROMPT, temperature: 0.4, maxTokens: 2048, thinkingBudget: 0, grounded: true },
    { skipModels },
  );
  void recordLlmQuota(result).catch(() => {}); // 429 를 KV 에 기록 → 다음 호출 사전 skip
  if (result.status !== "ok" || !result.text.trim()) {
    // 일시 실패(쿼터·그라운딩 장애)는 actionable 하지 않으니 200 으로(워크플로 빨강 방지) + 멱등 락 해제(재시도 허용).
    await releaseBriefingRun(MORNING_ECONOMY_BRIEFING_ID, dateKey);
    console.warn(`[finz/cron/briefing] LLM 실패(${result.status}) — 이번 회차 스킵`);
    return NextResponse.json({ status: "ok", posted: 0, reason: "llm-failed" });
  }
  void recordCall(result.model, result.usage.total).catch(() => {});
  const body = withSources(ensureDisclaimer(result.text.trim()), result.sources);
  const message = `📈 오늘의 경제 시황 (${todayKstLabel()})\n\n${body}`;

  // 구독 방에 전송. 소멸한 방(not-found)은 구독 SET 에서 self-heal 제거.
  // posted 는 실제 저장(res.message 존재)됐을 때만 — HARD_CEILING(400) 찬 방은 status ok 라도 드롭되므로 제외.
  let posted = 0;
  for (const roomId of rooms) {
    try {
      const res = await appendAnswerMessage(roomId, message);
      if (res.status === "ok" && res.message) {
        posted += 1;
        // 브리핑이 올라간 방의 멤버 전원에게 푸시(best-effort).
        void notifyBriefingMembers(roomId, message).catch(() => {});
      } else if (res.status === "not-found") {
        void unsubscribeBriefing(MORNING_ECONOMY_BRIEFING_ID, roomId).catch(() => {});
      }
    } catch (e) {
      console.warn(`[finz/cron/briefing] 방 ${roomId} 전송 실패`, e);
    }
  }
  return NextResponse.json({ status: "ok", posted, total: rooms.length });
}

const BRIEFING_SYSTEM_PROMPT = [
  "너는 FINZ 채팅방의 AI 친구 'finz' 다. 매일 아침 친구들에게 '오늘의 경제 시황'을 짧게 정리해 보낸다.",
  "한국어로, 친근한 반말로 쓴다.",
  "오늘 날짜 기준 주요 시장 동향(주가지수·환율·금리·유가나 큰 뉴스 1~2개)을 반드시 검색(Google Search)으로 확인해 사실로 정리하라. 추측으로 수치를 지어내지 마라.",
  "전체 본문은 300자 이내로 압축하라. 핵심만.",
  "특정 종목을 '사라/팔아라'처럼 지시하지 마라. 단정적 예측 금지 — '대화 소재'로 가볍게.",
].join("\n");

const BRIEFING_USER_PROMPT =
  "오늘의 경제 시황을 300자 이내로 정리해줘. 지수·환율·금리 등 핵심 흐름과 큰 뉴스 한두 개를 검색으로 확인해서 사실로 적고, 마지막에 친구들과 얘기해볼 한 줄을 덧붙여줘.";

const DISCLAIMER = "ℹ️ 투자 조언이 아니라 정보 참고용이야.";
function ensureDisclaimer(text: string): string {
  if (/참고용|투자\s*조언/.test(text)) return text;
  return `${text}\n\n${DISCLAIMER}`;
}

function withSources(text: string, sources?: { title: string; uri: string }[]): string {
  if (!sources || sources.length === 0) return text;
  const titles = [...new Set(sources.map((s) => s.title).filter(Boolean))].slice(0, 3);
  if (titles.length === 0) return text;
  return `${text}\n\n🔎 출처: ${titles.join(", ")}`;
}

// KST 기준 "M월 D일" 라벨. Date.now 기반(서버 UTC) → KST(+9h) 보정.
function todayKstLabel(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

// 멱등 키용 KST 날짜(YYYY-MM-DD). 같은 KST 날짜엔 한 번만 전송.
function kstDateKey(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 브리핑이 올라간 방의 멤버 전원에게 푸시. body 는 시황 본문 앞부분 미리보기(헤더 줄 제외).
async function notifyBriefingMembers(roomId: string, message: string): Promise<void> {
  if (!isFinzPushConfigured()) return;
  const group = await getFinzGroup(roomId);
  if (!group) return;
  const recipients = group.members.map((m) => m.memberId);
  if (recipients.length === 0) return;
  // message = "📈 오늘의 경제 시황 (날짜)\n\n본문..." → 본문 앞부분만 미리보기로.
  const bodyText = message.split("\n\n").slice(1).join(" ").replace(/\s+/g, " ").trim();
  const preview = bodyText.length > 90 ? `${bodyText.slice(0, 90)}…` : bodyText || "오늘의 시황이 도착했어요.";
  await sendToAccounts(recipients, {
    title: "📈 오늘의 경제 시황",
    body: preview,
    url: `/finz/party/${roomId}`,
    tag: `finz-briefing-${roomId}`,
  });
}
