"use client";

import { useEffect, useRef, useState } from "react";
import {
  enumeratePoints,
  type PointEntry,
  type TravelItem,
  type TravelPlan,
} from "@/lib/common/services/travel";

export type OsrmLeg = { distanceM: number; durationS: number };
export type LegsByItem = Map<TravelItem, OsrmLeg>;

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
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

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

type OsrmResult = {
  geometry: Array<[number, number]>;
  legs: OsrmLeg[]; // 길이 = points.length - 1, legs[j] = points[j]→points[j+1]
};

// OSRM public demo 로 day 내 구간 실제 도로 경로 받기.
// 실패 시 undefined — 호출자가 직선 fallback 처리.
async function fetchRouteGeometry(
  points: PointEntry[],
  signal: AbortSignal,
): Promise<OsrmResult | undefined> {
  if (points.length < 2) return undefined;
  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/${coordStr}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
        legs?: Array<{ distance?: number; duration?: number }>;
      }>;
    };
    const route = data.routes?.[0];
    const geo = route?.geometry?.coordinates;
    if (!Array.isArray(geo) || geo.length === 0) return undefined;
    const legs: OsrmLeg[] = (route?.legs ?? []).map((l) => ({
      distanceM: typeof l.distance === "number" ? l.distance : 0,
      durationS: typeof l.duration === "number" ? l.duration : 0,
    }));
    return { geometry: geo, legs };
  } catch {
    return undefined;
  }
}

export function MapView({
  plan,
  onLegsLoaded,
}: {
  plan: TravelPlan;
  onLegsLoaded?: (legs: LegsByItem) => void;
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  const points = enumeratePoints(plan);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [routeMode, setRouteMode] = useState<"road" | "straight" | "mixed">("straight");

  useEffect(() => {
    if (!appKey) return;
    if (points.length === 0) return;
    if (!containerRef.current) return;

    const abortController = new AbortController();
    let cancelled = false;
    setState("loading");

    loadKakaoSdk(appKey)
      .then(async (kakao) => {
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

        // 숙소 마커 — day 색과 구분되는 다크 컬러 + 호텔 아이콘
        const stayLat = plan.stay?.place?.lat;
        const stayLng = plan.stay?.place?.lng;
        if (typeof stayLat === "number" && typeof stayLng === "number") {
          const stayLl = new kakao.maps.LatLng(stayLat, stayLng);
          bounds.extend(stayLl);
          const stayContent = `<div style="background:#111827;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap;">🏨 숙소</div>`;
          new kakao.maps.CustomOverlay({
            position: stayLl,
            content: stayContent,
            yAnchor: 0.5,
            xAnchor: 0.5,
            map,
          });
        }

        // Day 별 그룹화
        const byDay = new Map<number, PointEntry[]>();
        for (const p of points) {
          const arr = byDay.get(p.dayIndex) ?? [];
          arr.push(p);
          byDay.set(p.dayIndex, arr);
        }

        // Day 별 경로: OSRM 으로 도로 경로 병렬 요청, 실패 시 직선 fallback
        let hadRoad = 0;
        let hadStraight = 0;
        const dayEntries = Array.from(byDay.entries());
        const routeResults = await Promise.all(
          dayEntries.map(([, path]) => fetchRouteGeometry(path, abortController.signal)),
        );

        if (cancelled) return;

        const legsByItem: LegsByItem = new Map();

        dayEntries.forEach(([dayIdx, path], i) => {
          if (path.length < 2) return;
          const result = routeResults[i];
          const latLngs: KakaoLatLng[] = result
            ? result.geometry.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng))
            : path.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
          if (result) {
            hadRoad++;
            // legs[j] = path[j] → path[j+1] 구간 — 도착 item 에 귀속
            result.legs.forEach((leg, j) => {
              const arrival = path[j + 1];
              if (arrival) legsByItem.set(arrival.item, leg);
            });
          } else {
            hadStraight++;
          }
          new kakao.maps.Polyline({
            path: latLngs,
            strokeWeight: 3,
            strokeColor: DAY_COLORS[dayIdx % DAY_COLORS.length] ?? "#2563eb",
            strokeOpacity: 0.7,
            strokeStyle: result ? "solid" : "shortdash",
            map,
          });
        });

        if (onLegsLoaded && legsByItem.size > 0) onLegsLoaded(legsByItem);

        if (hadRoad > 0 && hadStraight === 0) setRouteMode("road");
        else if (hadRoad === 0 && hadStraight > 0) setRouteMode("straight");
        else if (hadRoad > 0 && hadStraight > 0) setRouteMode("mixed");

        if (!bounds.isEmpty()) map.setBounds(bounds);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "unknown");
        setState("error");
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [appKey, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!appKey) return null;
  if (points.length === 0) return null;

  const statusText =
    state === "loading"
      ? "지도 불러오는 중…"
      : state === "error"
      ? `지도 로드 실패 (${errorMsg})`
      : state === "ready"
      ? `${points.length}개 장소 · ${plan.days.length}일 · ${
          routeMode === "road" ? "도로 경로" : routeMode === "mixed" ? "일부 도로 경로" : "직선"
        }`
      : "";

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">전체 경로</h3>
        <span className="text-xs text-neutral-400">{statusText}</span>
      </header>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
      {(plan.days.length > 1 || plan.stay?.place) && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          {plan.days.length > 1 &&
            plan.days.map((day, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                />
                <span>{day.label}</span>
              </li>
            ))}
          {plan.stay?.place && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden>🏨</span>
              <span>{plan.stay.place.name ?? plan.stay.name}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
