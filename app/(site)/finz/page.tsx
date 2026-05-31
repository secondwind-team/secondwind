import type { Metadata } from "next";
import { FinzApp } from "./_components/finz-app";

export const metadata: Metadata = {
  title: "FINZ",
  description: "친구들과 투자 취향을 캐릭터로 만들고 공유하는 실험",
};

export default function FinzPage() {
  return <FinzApp />;
}
