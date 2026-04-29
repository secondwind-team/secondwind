import { ImageResponse } from "next/og";

// iOS 의 "홈 화면에 추가" 가 svg 를 안 받아 별도 PNG 가 필요. ImageResponse 로
// 동적 생성해서 정적 PNG asset 부담 없이 처리.

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 84,
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-3px",
          fontFamily: "system-ui, sans-serif",
          borderRadius: 28,
        }}
      >
        sw
      </div>
    ),
    { ...size },
  );
}
