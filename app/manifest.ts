import type { MetadataRoute } from "next";

// Next.js App Router file convention — 자동으로 /manifest.webmanifest 로 노출됨.
// secondwind 의 사용자 대면 주력은 finz(메신저)이므로 홈 화면 설치·푸시 알림 경험을 finz 로 통일한다:
// 설치 시 finz 로 진입(start_url), 코랄 브랜드 아이콘, 크림 테마. 서비스 워커는 public/sw.js(푸시 전용).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/finz",
    name: "FINZ — 친구랑 투자 수다",
    short_name: "FINZ",
    description: "친구를 핸들로 더하고 캐릭터로 만나 투자 수다 떠는 메신저. 우정주·AI·아침 브리핑.",
    start_url: "/finz",
    scope: "/",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#fbf7f0",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/finz-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
