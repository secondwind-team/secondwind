import type { Metadata } from "next";
import { TravelForm } from "./_components/travel-form";
import { TravelHero } from "./_components/travel-hero";

export const metadata: Metadata = {
  title: "travel",
  description: "목적지·기간·분위기만 알려주면 하나의 확정안을 드립니다.",
};

export default function TravelPage() {
  return (
    <div className="space-y-8">
      <TravelHero />
      <TravelForm />
    </div>
  );
}
