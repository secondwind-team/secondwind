// Kakao Maps JS SDK — 공유 로더 및 타입.
// MapView (전체 경로) 와 PlacePopup (장소 상세 레이어) 에서 공유.

declare global {
  interface Window {
    kakao?: KakaoGlobal;
  }
}

export type KakaoGlobal = {
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
    services?: {
      Places: new () => KakaoPlaces;
      Status: { OK: string; ZERO_RESULT: string; ERROR: string };
    };
  };
};
export type KakaoLatLng = { __type: "LatLng" };
export type KakaoLatLngBounds = { extend: (ll: KakaoLatLng) => void; isEmpty: () => boolean };
export type KakaoMap = { setBounds: (b: KakaoLatLngBounds) => void; setCenter: (ll: KakaoLatLng) => void };
export type KakaoMarker = { setMap: (m: KakaoMap | null) => void };
export type KakaoPolyline = { setMap: (m: KakaoMap | null) => void };
export type KakaoCustomOverlay = { setMap: (m: KakaoMap | null) => void };
export type KakaoPlaceSearchResult = {
  id: string;
  place_name: string;
  category_name?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  place_url?: string;
  x: string;
  y: string;
};
export type KakaoPlaces = {
  keywordSearch: (
    keyword: string,
    callback: (result: KakaoPlaceSearchResult[], status: string) => void,
    options?: { size?: number },
  ) => void;
};

export function loadKakaoSdk(appKey: string): Promise<KakaoGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.kakao?.maps) return Promise.resolve(window.kakao);

  const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-maps-sdk]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener(
        "load",
        () => {
          if (window.kakao?.maps) {
            window.kakao.maps.load(() => resolve(window.kakao as KakaoGlobal));
          } else {
            reject(new Error("kakao-not-available"));
          }
        },
        { once: true },
      );
      existing.addEventListener("error", () => reject(new Error("sdk-load-failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.dataset.kakaoMapsSdk = "true";
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
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
