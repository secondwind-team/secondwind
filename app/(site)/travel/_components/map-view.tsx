"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadKakaoSdk,
  type KakaoCustomOverlay,
  type KakaoLatLng,
  type KakaoMarker,
} from "@/lib/common/kakao";
import {
  enumeratePoints,
  type PointEntry,
  type TravelItem,
  type TravelPlan,
} from "@/lib/common/services/travel";

export type OsrmLeg = { distanceM: number; durationS: number };
export type LegsByItem = Map<TravelItem, OsrmLeg>;

const DAY_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#c026d3"];
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

// 이 zoom level 보다 축소되면 day 라벨 CustomOverlay 를 hide 하고 MarkerClusterer 가
// 인접 포인트를 cluster 로 합친다. default zoom 8 보다 큰 값이라 첫 진입 시엔 라벨이
// 보이고, 사용자가 zoom out 하면 cluster 모드로 전환.
const LABEL_HIDE_LEVEL = 9;

type OsrmResult = {
  geometry: Array<[number, number]>;
  legs: OsrmLeg[]; // 길이 = points.length - 1, legs[j] = points[j]→points[j+1]
};

// abort 가능한 짧은 sleep — abort 시 즉시 resolve 해 effect cleanup 을 막지 않는다.
function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

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

        const dayLabelOverlays: KakaoCustomOverlay[] = [];
        const dayMarkers: KakaoMarker[] = [];

        for (const p of points) {
          const ll = new kakao.maps.LatLng(p.lat, p.lng);
          bounds.extend(ll);
          const color = DAY_COLORS[p.dayIndex % DAY_COLORS.length];
          const content = `<div style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:9999px;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap;">${p.label}</div>`;
          dayLabelOverlays.push(
            new kakao.maps.CustomOverlay({ position: ll, content, yAnchor: 0.5, xAnchor: 0.5, map }),
          );
          // 라벨이 hide 된 zoom 에서 클러스터링 대상이 될 dot 마커 (default Kakao pin).
          dayMarkers.push(new kakao.maps.Marker({ position: ll }));
        }

        // 숙소 마커 — day 색과 구분되는 다크 컬러 + 호텔 아이콘. 클러스터 대상이 아니라 항상 표시.
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

        // 클러스터러: 인접 day 포인트 마커를 zoom out 시 합쳐서 라벨 겹침 회피.
        // SDK 의 clusterer 라이브러리가 로드 안 됐을 수도 (구버전 캐시) — optional 처리.
        if (kakao.maps.MarkerClusterer) {
          const clusterer = new kakao.maps.MarkerClusterer({
            map,
            averageCenter: true,
            minLevel: LABEL_HIDE_LEVEL,
          });
          clusterer.addMarkers(dayMarkers);
        } else {
          // 클러스터러 없을 때는 마커만 직접 map 에 add — 라벨 hide 시 위치 단서 유지
          for (const marker of dayMarkers) marker.setMap(map);
        }

        // zoom 에 따라 day 라벨 toggle. zoom out 시 cluster + 마커만 보이고 라벨 사라짐.
        const updateLabelVisibility = () => {
          const visible = map.getLevel() < LABEL_HIDE_LEVEL;
          for (const overlay of dayLabelOverlays) {
            overlay.setMap(visible ? map : null);
          }
        };
        kakao.maps.event.addListener(map, "zoom_changed", updateLabelVisibility);

        // Day 별 그룹화
        const byDay = new Map<number, PointEntry[]>();
        for (const p of points) {
          const arr = byDay.get(p.dayIndex) ?? [];
          arr.push(p);
          byDay.set(p.dayIndex, arr);
        }

        // Day 별 경로: OSRM 으로 도로 경로 sequential 요청, 실패 시 직선 fallback.
        // public OSRM demo (router.project-osrm.org) 는 burst rate 정책이 명문화돼
        // 있지 않아 day 동시 요청이 직선 fallback 을 트리거하기 쉬움. 한 번에 하나씩
        // 보내고 짧은 간격을 둬 burst 가드. 프로덕션 OSRM 이전 (TODOS 참조) 전까지의
        // 안전판.
        let hadRoad = 0;
        let hadStraight = 0;
        const dayEntries = Array.from(byDay.entries());
        const routeResults: Array<OsrmResult | undefined> = [];
        for (let i = 0; i < dayEntries.length; i++) {
          if (cancelled || abortController.signal.aborted) break;
          const entry = dayEntries[i];
          if (!entry) continue;
          const [, path] = entry;
          routeResults.push(await fetchRouteGeometry(path, abortController.signal));
          if (i < dayEntries.length - 1) {
            await waitOrAbort(120, abortController.signal);
          }
        }

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
        <h3 className="text-sm font-semibold text-[var(--ink)]">전체 경로</h3>
        <span className="text-xs text-[var(--muted)]">{statusText}</span>
      </header>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-100"
      />
      {(plan.days.length > 1 || plan.stay?.place) && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
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
