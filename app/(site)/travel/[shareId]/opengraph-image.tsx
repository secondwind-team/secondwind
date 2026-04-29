import { ImageResponse } from "next/og";
import { enumeratePoints } from "@/lib/common/services/travel";
import { getTravelShare, isShareId } from "@/lib/server/travel-share-store";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "secondwind 여행 계획 미리보기";

const COLORS = {
  background: "#eef3f8",
  paper: "#ffffff",
  ink: "#101828",
  muted: "#64748b",
  line: "#d7dee8",
  accent: "#2563eb",
  accentSoft: "#dbeafe",
};

type RouteParams = { shareId: string };

export default async function OpenGraphImage({ params }: { params: Promise<RouteParams> }) {
  const { shareId } = await params;
  const snapshot = isShareId(shareId) ? await getTravelShare(shareId) : null;

  if (!snapshot) {
    return renderFallback();
  }

  const { input, plan } = snapshot;
  const dayCount = plan.days.length;
  const placeCount = enumeratePoints(plan).length;
  const stayName = plan.stay?.name;

  const title = `${input.destination} 여행`;
  const subtitle = `${dayCount}일 · ${input.startDate} ~ ${input.endDate}`;
  const summary = stayName
    ? `숙소 · ${stayName}`
    : placeCount > 0
      ? `장소 ${placeCount}곳`
      : "여행 계획";

  const fontText = ["secondwind", "TRAVEL", title, subtitle, summary].join(" ");
  let fontData: ArrayBuffer;
  try {
    fontData = await loadKoreanFont(fontText);
  } catch {
    // Google Fonts CSS API 실패·차단 시 한글 박스 깨짐 대신 generic fallback 으로.
    return renderFallback();
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: COLORS.background,
          padding: "72px 80px",
          fontFamily: '"Noto Sans KR", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: COLORS.accent,
            textTransform: "uppercase",
          }}
        >
          <span>secondwind</span>
          <span style={{ color: COLORS.line }}>·</span>
          <span>TRAVEL</span>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: COLORS.ink,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 400,
              color: COLORS.muted,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 28px",
            background: COLORS.paper,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.09)",
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.ink,
            alignSelf: "flex-start",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: COLORS.accent,
            }}
          />
          {summary}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans KR",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}

function renderFallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: COLORS.background,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: COLORS.accent,
            textTransform: "uppercase",
          }}
        >
          secondwind · TRAVEL
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.ink,
          }}
        >
          shared travel
        </div>
      </div>
    ),
    { ...size },
  );
}

// Google Fonts CSS API 에서 텍스트 기반 동적 subset 의 ttf URL 을 받아 폰트 파일을 가져온다.
// 매 요청마다 외부 호출이지만 OG 이미지 자체가 Next.js 의 ISR 캐시를 통하므로 실사용 빈도는 낮다.
async function loadKoreanFont(text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl).then((r) => r.text());
  const match = css.match(/src:\s*url\((https:[^)]+)\)\s*format\(['"](?:opentype|truetype)['"]\)/);
  if (!match || !match[1]) {
    throw new Error("noto-sans-kr-url-not-found");
  }
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
}
