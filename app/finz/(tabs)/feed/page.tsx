"use client";

import { useFinzAccount } from "@/app/finz/_components/finz-account-context";
import { FinzFeedList } from "@/app/finz/_components/finz-feed-list";

// 피드 탭 — 친구들의 활동이 SNS 타임라인처럼 쌓인다.
// 상단 헤더·하단 탭바는 (tabs)/layout.tsx 가 제공하므로 본문만 렌더한다.
export default function FinzFeedPage() {
  // 게이트 ok 일 때만 마운트되므로 계정은 항상 존재(참조만, 추후 본인 활동 강조 등 확장 여지).
  useFinzAccount();

  return (
    <div className="pb-6">
      <FinzFeedList />
    </div>
  );
}
