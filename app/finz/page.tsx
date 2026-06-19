import { redirect } from "next/navigation";

// 메신저 시작 = 대화 탭. (취향카드 단독 시작페이지는 온보딩/프로필로 흡수됨.)
export default function FinzPage() {
  redirect("/finz/chats");
}
