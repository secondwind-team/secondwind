import { redirect } from "next/navigation";

// 레거시 단독 "파티 만들기" 페이지는 대화 탭으로 흡수됨(대화방을 거기서 만든다).
export default function FinzPartyCreatePage() {
  redirect("/finz/chats");
}
