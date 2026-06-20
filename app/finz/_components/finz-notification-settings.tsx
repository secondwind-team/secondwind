"use client";

import { Bell, BellRing, Loader2, Send, Share, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// 브라우저 푸시 가능 여부 + 현재 권한/구독을 종합한 화면 상태.
type PushState =
  | "loading"
  | "unsupported" // Push API 자체 미지원(구형 브라우저 등)
  | "ios-needs-install" // iOS Safari 탭 — 홈 화면 추가(standalone) 후에만 가능
  | "prompt" // 지원 + 권한 미요청 → 스위치로 켤 수 있음
  | "denied" // 권한 거부 → 설정에서 수동 허용 필요
  | "on"; // 권한 granted + 구독 존재

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// 프로필 알림 설정 섹션. 권한·구독·테스트 전 과정을 클라이언트에서 처리하고,
// iOS/안드로이드에서 알림을 받는 방법을 상태에 따라 안내한다.
export function FinzNotificationSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null); // 액션 결과 인라인 메시지

  // 현재 상태 재계산(권한·구독 조회). mount + 각 액션 후 호출.
  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      // iOS 는 홈 화면 standalone PWA 안에서만 Push 가 생긴다. Safari 탭이면 "홈 화면 추가" 안내.
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setState(isIOS && !standalone ? "ios-needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(Notification.permission === "granted" && sub ? "on" : "prompt");
    } catch {
      setState("prompt");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 알림 켜기 — 사용자 제스처 안에서 권한 요청 → 구독 → 서버 저장.
  const enable = useCallback(async () => {
    if (!PUBLIC_KEY) {
      setToast("알림 키가 설정되지 않았어요(관리자 설정 필요).");
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refresh();
        if (permission === "denied") setToast("알림이 거부됐어요. 브라우저 설정에서 허용해줘.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
        });
      }
      const keys = sub.toJSON().keys;
      const res = await fetch("/api/finz/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys }),
      });
      if (!res.ok) throw new Error("subscribe-failed");
      setState("on");
      setToast("알림을 켰어요 🔔");
    } catch (e) {
      console.warn("[finz] 알림 켜기 실패", e);
      setToast("알림을 켜지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  // 알림 끄기 — 구독 해제 + 서버에서 제거.
  const disable = useCallback(async () => {
    setBusy(true);
    setToast(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // 서버 행을 먼저 지우고(실패해도) 브라우저 구독 해제.
        await fetch("/api/finz/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("prompt");
      setToast("알림을 껐어요.");
    } catch (e) {
      console.warn("[finz] 알림 끄기 실패", e);
      setToast("알림을 끄지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setBusy(false);
    }
  }, []);

  // 본인의 모든 기기로 테스트 알림 발송.
  const sendTest = useCallback(async () => {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/finz/push/test", { method: "POST" });
      const data = (await res.json()) as { status: string; sent?: number };
      if (data.status === "ok" && (data.sent ?? 0) > 0) setToast("테스트 알림을 보냈어! 잠시 뒤 알림이 떠.");
      else if (data.status === "ok") setToast("보낼 기기가 없어. 알림을 먼저 켜줘.");
      else setToast("테스트 발송에 실패했어.");
    } catch {
      setToast("테스트 발송에 실패했어.");
    } finally {
      setBusy(false);
    }
  }, []);

  const showSwitch = state === "on" || state === "prompt";
  const on = state === "on";

  return (
    <section className="fz-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--fz-coral-ink)]" aria-hidden />
          <p className="fz-seclabel">알림</p>
        </div>
        {showSwitch && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={on ? "알림 끄기" : "알림 켜기"}
            disabled={busy}
            onClick={() => void (on ? disable() : enable())}
            className="fz-switch"
          >
            <span className="fz-switch__thumb" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {state === "loading" && <p className="text-sm text-[var(--fz-muted)]">불러오는 중…</p>}

        {state === "prompt" && (
          <p className="text-sm leading-relaxed text-[var(--fz-muted)]">
            알림을 켜면 앱을 닫아도 새 메시지·친구 요청·아침 브리핑을 휴대폰으로 받을 수 있어요. 위 스위치로 켜줘.
          </p>
        )}

        {on && (
          <>
            <p className="text-sm leading-relaxed text-[var(--fz-ink)]">
              알림이 켜져 있어요. 새 메시지·친구 요청·아침 브리핑이 오면 휴대폰으로 알려줄게요.
            </p>
            <button type="button" disabled={busy} onClick={() => void sendTest()} className="fz-btn fz-btn--ghost w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              테스트 알림 보내기
            </button>
          </>
        )}

        {state === "denied" && (
          <div className="fz-note">
            <p className="font-semibold text-[var(--fz-ink)]">알림이 차단돼 있어요.</p>
            <p className="mt-1">
              브라우저·휴대폰 설정에서 이 사이트의 알림을 허용해야 받을 수 있어요. iPhone 은 홈 화면 앱을 지웠다가 다시 추가하면 초기화돼요.
            </p>
          </div>
        )}

        {state === "ios-needs-install" && <IosInstallGuide />}

        {state === "unsupported" && (
          <div className="fz-note">
            이 브라우저는 푸시 알림을 지원하지 않아요. 휴대폰의 Chrome(안드로이드) 또는 홈 화면에 추가한 Safari 앱(iPhone)에서 시도해줘.
          </div>
        )}

        {toast && (
          <p className="fz-note" role="status">
            {toast}
          </p>
        )}
      </div>
    </section>
  );
}

// iOS Safari 탭 — 홈 화면 추가(standalone) 후에만 푸시가 가능하다는 단계 안내.
function IosInstallGuide() {
  return (
    <div className="fz-note space-y-2">
      <p className="flex items-center gap-2 font-semibold text-[var(--fz-ink)]">
        <Smartphone className="h-4 w-4" aria-hidden />
        iPhone·iPad 에서 알림 받기
      </p>
      <ol className="ml-1 list-inside list-decimal space-y-1">
        <li>
          Safari 하단 <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 공유 버튼을 눌러요.
        </li>
        <li>{'"홈 화면에 추가"'}를 선택해요.</li>
        <li>홈 화면의 FINZ 아이콘으로 앱을 열어요.</li>
        <li>프로필 → 알림에서 스위치를 켜요.</li>
      </ol>
      <p className="text-xs">Safari 탭에서는 iOS 가 알림을 막아요. 꼭 홈 화면 앱으로 열어야 해요.</p>
    </div>
  );
}

// base64url(VAPID 공개키) → Uint8Array. pushManager.subscribe 의 applicationServerKey 형식(원문 문자열 그대로는 안 됨).
// 반환을 ArrayBuffer 백킹으로 명시 — BufferSource(ArrayBufferView<ArrayBuffer>) 에 할당되도록.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
