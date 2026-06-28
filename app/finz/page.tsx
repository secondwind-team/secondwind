import { redirect } from "next/navigation";
import { resolveAccount } from "@/lib/server/finz-account";

// 메신저 시작 = 대화 탭. 단, 계정은 있는데 캐릭터(취향카드)가 아직 없으면 첫 진입을 프로필로 보낸다 —
// '대화' 탭의 막다른 "캐릭터가 필요해" 빈 상태에 곧장 떨어지는 첫인상을 피하기 위함.
// 미로그인/온보딩 전(anon·needs-onboarding)은 chats 로 보내 기존 게이트가 로그인·온보딩을 처리하게 둔다.
export default async function FinzPage() {
  const me = await resolveAccount();
  if (me.status === "ok" && me.account.selectedCardIds.length === 0) {
    redirect("/finz/profile");
  }
  redirect("/finz/chats");
}
