"use client";

import { useEffect, useRef } from "react";
import type { FinzChartPayload } from "@/lib/common/services/finz-chat";

// TradingView 미니 차트 위젯 버블 — 심볼만 받아 실시간 차트를 임베드(베이크된 이미지 아님 → 매번 라이브).
// 위젯 스크립트가 컨테이너에 iframe 을 주입한다. 심볼은 JSON.stringify 로만 들어가 XSS 안전.
// SSR 시 컨테이너는 비어 있고(서버=클라 동일) useEffect 가 클라에서만 주입 → 하이드레이션 mismatch 없음.
export function FinzChartBubble({ payload }: { payload: FinzChartPayload }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 심볼 변경/재마운트 시 깨끗이 다시 그린다.
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    // 외부 스크립트 로드 실패(네트워크·차단) 시 빈 카드 대신 안내. 위젯 자체가 뜨면 위젯이 컨테이너를 채운다.
    script.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML =
          '<p style="padding:24px 16px;text-align:center;font-size:13px;color:var(--fz-muted)">차트를 불러오지 못했어요 😢</p>';
      }
    };
    script.innerHTML = JSON.stringify({
      symbol: payload.symbol,
      width: "100%",
      height: 200,
      locale: "kr",
      dateRange: "3M",
      colorTheme: "light",
      isTransparent: true,
      autosize: false,
      chartOnly: false,
    });
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, [payload.symbol]);

  return (
    <div className="fz-card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-sm font-semibold text-[var(--fz-ink)]">
          {payload.label || payload.symbol}
        </p>
        <span className="fz-tag">{payload.symbol}</span>
      </div>
      <div ref={containerRef} className="tradingview-widget-container px-2 pt-1" aria-label={`${payload.label} 차트`} />
      <p className="px-4 pb-3 pt-1 text-xs text-[var(--fz-muted)]">
        📈 TradingView 실시간 차트 · 투자 조언이 아니라 정보 참고용이야.
      </p>
    </div>
  );
}
