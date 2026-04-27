"use client";

// Web Push subscribe / unsubscribe control. Lives in Settings →
// Notifications. Three states surfaced in one button:
//
//   - browser doesn't support Push API → disabled, "Not supported" hint
//   - permission denied (user clicked Block earlier) → disabled,
//     "Blocked in browser settings — re-enable in site permissions"
//   - permission granted, no subscription → enabled "Enable browser
//     alerts" button
//   - permission granted, subscribed       → enabled "Disable browser
//     alerts" button + a green dot
//
// We deliberately keep this client-only and skip SSR — the Service
// Worker registration depends on `navigator` and `window.Notification`
// which don't exist on the server.

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "unsubscribed";

export function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!reg) {
          setStatus("unsubscribed");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  // Auto-clear errors after 5s — same UX rule as the settings editors.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  async function subscribe() {
    if (!VAPID_PUBLIC_KEY) {
      setError("Server is missing VAPID public key");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      // SW must be active before pushManager.subscribe works.
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        setError("Permission was not granted");
        return;
      }

      // ArrayBuffer cast — TS narrows Uint8Array<ArrayBufferLike> in
      // a way the PushManager.subscribe types don't accept. The
      // underlying buffer IS an ArrayBuffer at runtime; this is just
      // a TS lib mismatch we work around at the boundary.
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        // Roll back the browser-side subscription so the next click
        // doesn't think we're already subscribed.
        await sub.unsubscribe().catch(() => {});
        setError(body.error ?? `Server rejected subscription (${res.status})`);
        setStatus("unsubscribed");
        return;
      }
      setStatus("subscribed");
    } catch (e) {
      setError((e as Error).message ?? "Failed to subscribe");
    } finally {
      setPending(false);
    }
  }

  async function unsubscribe() {
    setPending(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("unsubscribed");
    } catch (e) {
      setError((e as Error).message ?? "Failed to unsubscribe");
    } finally {
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        checking…
      </span>
    );
  }

  if (status === "unsupported") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        not supported in this browser
      </span>
    );
  }

  if (status === "denied") {
    return (
      <div className="text-right">
        <span className="inline-flex items-center gap-2 text-xs text-rose-300">
          <BellOff className="h-3.5 w-3.5" />
          blocked
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          re-enable in your browser&rsquo;s site settings
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <span className="text-xs text-rose-300">{error}</span>
      )}
      {status === "subscribed" ? (
        <button
          type="button"
          onClick={unsubscribe}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/20 disabled:opacity-50 transition"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          On — click to disable
        </button>
      ) : (
        <button
          type="button"
          onClick={subscribe}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-50 transition"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          Enable browser alerts
        </button>
      )}
    </div>
  );
}

// Convert Web Push's base64url-encoded VAPID public key to a Uint8Array
// the PushManager expects as applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}
