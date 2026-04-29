"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { loadKakaoSdk } from "@/lib/common/kakao";
import { kakaoMapSearchUrl, type TravelItem } from "@/lib/common/services/travel";

type Props = {
  item: TravelItem | null;
  onClose: () => void;
};

// 장소 상세 레이어 팝업 — 카드의 지도 아이콘 클릭 시 외부 카카오맵 앱/탭 대신
// 인앱으로 미니맵 + 장소 정보 표시. ESC · 바깥 클릭 · X 로 닫힘.
export function PlacePopup({ item, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkFailed, setSdkFailed] = useState(false);

  // ESC 로 닫기
  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  // 미니맵 렌더 — lat/lng 있을 때만
  useEffect(() => {
    setSdkFailed(false);
    const lat = item?.place?.lat;
    const lng = item?.place?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    const container = mapRef.current;
    if (!container) return;
    const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
    if (!appKey) {
      setSdkFailed(true);
      return;
    }

    let cancelled = false;
    loadKakaoSdk(appKey)
      .then((kakao) => {
        if (cancelled || !container) return;
        const center = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(container, { center, level: 3 });
        new kakao.maps.Marker({ position: center, map });
      })
      .catch(() => {
        if (!cancelled) setSdkFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;

  const place = item.place;
  const hasGeo = typeof place?.lat === "number" && typeof place?.lng === "number";
  const showMap = hasGeo && !sdkFailed;
  const kakaoUrl = place?.url ?? (item.place_query ? kakaoMapSearchUrl(item.place_query) : undefined);
  const title = place?.name ?? item.text;
  const fallbackMessage = sdkFailed
    ? "지도를 불러오지 못했습니다."
    : (item.place_warning ?? "정확한 위치를 확인하지 못했어요.");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold leading-tight text-[var(--ink)]">
              {title}
            </h2>
            {place?.category && (
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {place.category}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {showMap ? (
          <div
            ref={mapRef}
            className="h-64 w-full bg-slate-100"
            aria-label="위치 지도"
          />
        ) : (
          <div className="bg-slate-50 p-4 text-xs leading-relaxed text-[var(--muted)]">
            {fallbackMessage} 아래 카카오맵 링크에서 <b>&quot;{item.place_query ?? item.text}&quot;</b> 검색 결과를 확인해보세요.
          </div>
        )}

        {(place?.address || place?.phone) && (
          <dl className="space-y-2 p-4 text-sm">
            {place?.address && (
              <div className="flex gap-3">
                <dt className="w-10 shrink-0 text-xs text-[var(--muted)]">주소</dt>
                <dd className="flex-1 text-[var(--ink)]">{place.address}</dd>
              </div>
            )}
            {place?.phone && (
              <div className="flex gap-3">
                <dt className="w-10 shrink-0 text-xs text-[var(--muted)]">전화</dt>
                <dd className="flex-1">
                  <a
                    href={`tel:${place.phone}`}
                    className="text-[var(--ink)] underline underline-offset-2"
                  >
                    {place.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}

        {kakaoUrl && (
          <div className="border-t border-[var(--line)] p-3">
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-xl border border-[var(--line)] bg-white py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              카카오맵에서 열기 (길찾기·거리뷰)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
