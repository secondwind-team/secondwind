"use client";

import { useEffect, useRef, useState } from "react";
import type { TravelPlan } from "@/lib/common/services/travel";

declare global {
  interface Window {
    // Kakao Maps 전역 — SDK 런타임 타입 (세부 타이핑은 작고 단순한 래퍼로 대체)
    kakao?: KakaoGlobal;
  }
}

type KakaoGlobal = {
  maps: {
    load: (cb: () => void) => void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    LatLngBounds: new () => KakaoLatLngBounds;
    Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
    Marker: new (options: { position: KakaoLatLng; map?: KakaoMap; title?: string }) => KakaoMarker;
    Polyline: new (options: {
      path: KakaoLatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: string;
      map?: KakaoMap;
    }) => KakaoPolyline;
    CustomOverlay: new (options: {
      position: KakaoLatLng;
      content: string;
      yAnchor?: number;
      xAnchor?: number;
      map?: KakaoMap;
    }) => KakaoCustomOverlay;
  };
};
type KakaoLatLng = { __type: "LatLng" };
type KakaoLatLngBounds = { extend: (ll: KakaoLatLng) => void; isEmpty: () => boolean };
type KakaoMap = { setBounds: (b: KakaoLatLngBounds) => void; setCenter: (ll: KakaoLatLng) => void };
type KakaoMarker = { setMap: (m: KakaoMap | null) => void };
type KakaoPolyline = { setMap: (m: KakaoMap | null) => void };
type KakaoCustomOverlay = { setMap: (m: KakaoMap | null) => void };

const DAY_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#c026d3"];

type Point = {
  lat: number;
  lng: number;
  dayIndex: number;
  orderInDay: number;
  label: string;
  text: string;
};

function collectPoints(plan: TravelPlan): Point[] {
  const points: Point[] = [];
  plan.days.forEach((day, dayIndex) => {
    let orderInDay = 0;
    for (const item of day.items) {
      const lat = item.place?.lat;
      const lng = item.place?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      orderInDay += 1;
      points.push({
        lat,
        lng,
        dayIndex,
        orderInDay,
        label: `${dayIndex + 1}-${orderInDay}`,
        text: item.place?.name ?? item.text,
      });
    }
  });
  return points;
}

function loadKakaoSdk(appKey: string): Promise<KakaoGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.kakao?.maps) return Promise.resolve(window.kakao);

  const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-maps-sdk]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => {
        if (window.kakao?.maps) {
          window.kakao.maps.load(() => resolve(window.kakao as KakaoGlobal));
        } else {
          reject(new Error("kakao-not-available"));
        }
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("sdk-load-failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.dataset.kakaoMapsSdk = "true";
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    s.onload = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(window.kakao as KakaoGlobal));
      } else {
        reject(new Error("kakao-not-available"));
      }
    };
    s.onerror = () => reject(new Error("sdk-load-failed"));
    document.head.appendChild(s);
  });
}

export function MapView({ plan }: { plan: TravelPlan }) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const points = collectPoints(plan);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!appKey) return;
    if (points.length === 0) return;
    if (!containerRef.current) return;

    let cancelled = false;
    setState("loading");

    loadKakaoSdk(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;

        const bounds = new kakao.maps.LatLngBounds();
        const firstPoint = points[0];
        if (!firstPoint) return;

        const firstLatLng = new kakao.maps.LatLng(firstPoint.lat, firstPoint.lng);
        const map = new kakao.maps.Map(containerRef.current, { center: firstLatLng, level: 8 });

        for (const p of points) {
          const ll = new kakao.maps.LatLng(p.lat, p.lng);
          bounds.extend(ll);
          const color = DAY_COLORS[p.dayIndex % DAY_COLORS.length];
          const content = `<div style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:9999px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap;">${p.label}</div>`;
          new kakao.maps.CustomOverlay({ position: ll, content, yAnchor: 0.5, xAnchor: 0.5, map });
        }

        // Day 별로 polyline 그리기
        const byDay = new Map<number, KakaoLatLng[]>();
        for (const p of points) {
          const arr = byDay.get(p.dayIndex) ?? [];
          arr.push(new kakao.maps.LatLng(p.lat, p.lng));
          byDay.set(p.dayIndex, arr);
        }
        for (const [dayIdx, path] of byDay.entries()) {
          if (path.length < 2) continue;
          new kakao.maps.Polyline({
            path,
            strokeWeight: 3,
            strokeColor: DAY_COLORS[dayIdx % DAY_COLORS.length] ?? "#2563eb",
            strokeOpacity: 0.7,
            strokeStyle: "solid",
            map,
          });
        }

        if (!bounds.isEmpty()) map.setBounds(bounds);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "unknown");
        setState("error");
      });

    return () => { cancelled = true; };
  }, [appKey, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!appKey) return null;
  if (points.length === 0) return null;

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">전체 경로</h3>
        <span className="text-xs text-neutral-400">
          {state === "loading" && "지도 불러오는 중…"}
          {state === "ready" && `${points.length}개 장소 · ${plan.days.length}일`}
          {state === "error" && `지도 로드 실패 (${errorMsg})`}
        </span>
      </header>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
      {plan.days.length > 1 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          {plan.days.map((day, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
              />
              <span>{day.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
