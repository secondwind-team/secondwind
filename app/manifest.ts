import type { MetadataRoute } from "next";

// Next.js App Router 의 file convention — 자동으로 /manifest.webmanifest 로 노출됨.
// PWA 설치 가능 (홈 화면 추가). 서비스 워커 / 오프라인 캐시는 별도 작업.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "secondwind",
    short_name: "secondwind",
    description: "3명이 만드는 바이브 코딩 실험장. 여행 계획부터.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef3f8",
    theme_color: "#eef3f8",
    lang: "ko",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
