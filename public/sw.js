/* FINZ 푸시 전용 서비스 워커 (scope "/").
 * 오프라인 캐시/precache 없음 — 푸시 수신·알림 클릭만 담당하는 미니멀 SW.
 * push: 서버가 보낸 payload(title/body/url/tag)를 OS 알림으로 표시.
 * notificationclick: 이미 열린 finz 탭이 있으면 focus + 이동, 없으면 새 창.
 * 파일 수정이 기기에 즉시 퍼지도록 skipWaiting + clients.claim
 * (단, 캐시 헤더는 next.config.mjs 에서 no-store 로 박아야 CDN 이 구버전을 안 준다).
 */

self.addEventListener("install", () => {
  // 설치 즉시 활성 대기 없이 새 SW 로 교체.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 이미 열린 페이지들도 새 SW 가 바로 제어.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "FINZ";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png", // 알림 카드의 큰 컬러 아이콘(코랄 f)
    // 상태바 작은 아이콘은 안드로이드가 알파(실루엣)만 쓴다 — 컬러 PNG 를 주면 흰 네모가 된다.
    // 투명 배경 + 흰 "f" 모노크롬이라야 f 실루엣으로 렌더된다.
    badge: "/badge-96.png",
    tag: data.tag || undefined,
    // tag 가 같아도 새 알림이 사용자에게 한 번 더 뜨도록(메신저 기본 동작).
    renotify: Boolean(data.tag),
    data: { url: data.url || "/finz" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/finz";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 finz 창이 있으면 그쪽으로 이동 + focus(중복 탭 방지).
      for (const client of clientList) {
        if (client.url.includes("/finz") && "focus" in client) {
          if ("navigate" in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      // 없으면 새 창.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
