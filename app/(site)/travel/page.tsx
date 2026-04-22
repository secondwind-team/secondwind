import type { Metadata } from "next";
import { TravelForm } from "./_components/travel-form";

export const metadata: Metadata = {
  title: "travel",
  description: "목적지·기간·분위기만 알려주면 하나의 확정안을 드립니다.",
};

export default function TravelPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">travel</h1>
        <p className="text-neutral-600 dark:text-neutral-300">
          J 강박에 쓰이는 여행 계획. 선택지는 숨기고 하나의 확정안만 보여드려요.
        </p>
        <p className="inline-block rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          지금은 <span className="font-semibold">국내 여행 전용</span>입니다. 해외 여행은 다음 이터레이션에서 지원 예정.
        </p>
      </header>

      <TravelForm />
    </div>
  );
}
