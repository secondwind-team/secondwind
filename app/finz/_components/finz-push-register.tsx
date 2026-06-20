"use client";

import { useEffect } from "react";

// finz 진입 시 푸시 서비스 워커를 등록한다(로그인 무관·멱등).
// 등록만 담당 — 실제 권한 요청/구독은 프로필의 알림 설정에서 사용자 제스처로 일어난다.
// iOS 는 홈 화면 standalone PWA 안에서 등록돼야 푸시가 동작하지만, 등록 자체는 어디서 해도 무해하다.
export function FinzPushRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // register 는 멱등 — StrictMode 이중 실행·재방문에도 안전(같은 scope 면 기존 등록 재사용).
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.warn("[finz] 서비스 워커 등록 실패", e);
    });
  }, []);
  return null;
}
