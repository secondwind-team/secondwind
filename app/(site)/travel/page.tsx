import type { Metadata } from "next";
import { TravelForm } from "./_components/travel-form";

export const metadata: Metadata = {
  title: "travel",
  description: "목적지·기간·분위기만 알려주면 하나의 확정안을 드립니다.",
};

export default function TravelPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">travel</h1>
        <p className="text-neutral-600 dark:text-neutral-300">
          J 강박에 쓰이는 여행 계획. 선택지는 숨기고 하나의 확정안만 보여드려요.
        </p>
      </header>

      <TravelForm />
    </div>
  );
}
