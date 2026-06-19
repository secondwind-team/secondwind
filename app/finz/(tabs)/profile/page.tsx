"use client";

import { useFinzAccount } from "@/app/finz/_components/finz-account-context";
import { FinzProfileView } from "@/app/finz/_components/finz-profile-view";

// 프로필 탭. 상단 헤더·하단 탭바는 상위 (tabs)/layout 이 제공 — 여기선 본문만 렌더한다.
// 게이트가 ok 일 때만 마운트되므로 account 는 항상 존재한다.
export default function FinzProfilePage() {
  const account = useFinzAccount();
  return <FinzProfileView account={account} />;
}
