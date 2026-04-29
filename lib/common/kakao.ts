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
    MarkerClusterer?: new (options: {
      map: KakaoMap;
      averageCenter?: boolean;
      minLevel?: number;
      disableClickZoom?: boolean;
      gridSize?: number;
    }) => KakaoMarkerClusterer;
    event: {
      addListener: (target: KakaoMap, type: string, handler: () => void) => void;
    };
    services?: {
      Places: new () => KakaoPlaces;
      Status: { OK: string; ZERO_RESULT: string; ERROR: string };
    };
  };
};
export type KakaoLatLng = { __type: "LatLng" };
export type KakaoLatLngBounds = { extend: (ll: KakaoLatLng) => void; isEmpty: () => boolean };
export type KakaoMap = {
  setBounds: (b: KakaoLatLngBounds) => void;
  setCenter: (ll: KakaoLatLng) => void;
  getLevel: () => number;
};
export type KakaoMarker = { setMap: (m: KakaoMap | null) => void };
export type KakaoPolyline = { setMap: (m: KakaoMap | null) => void };
export type KakaoCustomOverlay = { setMap: (m: KakaoMap | null) => void };
export type KakaoMarkerClusterer = {
  addMarkers: (markers: KakaoMarker[]) => void;
  clear: () => void;
  setMap: (m: KakaoMap | null) => void;
};
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

// 동일 SDK 를 map-view / stay-picker / place-popup 세 곳에서 동시에 호출함.
// 모듈 레벨 promise 로 memoize 하지 않으면, 첫 호출의 onload 가 fire 된 직후
// 두 번째 호출이 existing script 에 addEventListener 를 붙이면 영원히 pending
// 되는 race 가 가능. 캐시는 실패 시 reset 해 재시도를 허용한다.
let cachedSdk: Promise<KakaoGlobal> | null = null;

export function loadKakaoSdk(appKey: string): Promise<KakaoGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (cachedSdk) return cachedSdk;

  cachedSdk = createSdkPromise(appKey);
  cachedSdk.catch(() => {
    cachedSdk = null;
  });
  return cachedSdk;
}

function createSdkPromise(appKey: string): Promise<KakaoGlobal> {
  if (window.kakao?.maps) {
    const k = window.kakao;
    return new Promise((resolve) => k.maps.load(() => resolve(k)));
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-maps-sdk]");
    const target = existing ?? createScriptTag(appKey);
    target.addEventListener(
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
    target.addEventListener("error", () => reject(new Error("sdk-load-failed")), { once: true });
    if (!existing) document.head.appendChild(target);
  });
}

function createScriptTag(appKey: string): HTMLScriptElement {
  const s = document.createElement("script");
  s.async = true;
  s.defer = true;
  s.dataset.kakaoMapsSdk = "true";
  s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services,clusterer`;
  return s;
}
