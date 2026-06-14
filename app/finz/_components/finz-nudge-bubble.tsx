"use client";

import { Copy, Sparkles, Users } from "lucide-react";
import type { FinzNudge } from "@/lib/common/services/finz-chat";

// "이제 뭐 할까" 코칭 버블 — 비저장(ephemeral). 현재 상태에서 단 하나. CTA 가 다음 행동을 명확히 보여준다.
// invite/pick/position/summary 는 actionable 버튼; missingMemberName 이 있으면(상대 입장 대기) 정보 안내.
export function FinzNudgeBubble({ nudge, onCta }: { nudge: FinzNudge; onCta: (cta: FinzNudge["cta"]) => void }) {
  const waiting = nudge.cta === "position" && Boolean(nudge.missingMemberName);

  return (
    <div className="flex items-start gap-2">
      <span className="fz-avatar mt-0.5 h-8 w-8 shrink-0 text-base" aria-hidden>
        🤖
      </span>
      <div className="fz-bubble max-w-[80%] p-3.5">
        <p className="text-sm leading-relaxed text-[var(--fz-ink)]">{nudge.text}</p>
        {!waiting && (
          <button type="button" onClick={() => onCta(nudge.cta)} className="fz-btn mt-2.5 text-xs">
            {nudge.cta === "invite" ? <Users className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {CTA_LABEL[nudge.cta]}
          </button>
        )}
      </div>
    </div>
  );
}

const CTA_LABEL: Record<FinzNudge["cta"], string> = {
  invite: "초대 링크 복사",
  pick: "우정주 뽑기",
  position: "내 입장 남기기",
  summary: "AI 요약 받기",
};
