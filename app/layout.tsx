import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "secondwind",
    template: "%s · secondwind",
  },
  description: "3명이 만드는 바이브 코딩 실험장. 여행 계획부터 시작합니다.",
  openGraph: {
    title: "secondwind",
    description: "3명이 만드는 바이브 코딩 실험장. 여행 계획부터 시작합니다.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "secondwind",
    description: "3명이 만드는 바이브 코딩 실험장.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef3f8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen text-[var(--ink)] antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
