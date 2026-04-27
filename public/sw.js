// EdgeNiq Service Worker — minimal, single purpose: receive Web Push
// events from the bot and surface them as system notifications.
//
// We deliberately don't add caching / offline / background sync. The
// dashboard is always-fresh server-rendered so a stale offline cache
// would actively mislead. Push is the only feature here.

self.addEventListener("install", () => {
  // Skip waiting — when we ship a new SW, take over immediately so
  // users don't have to close every tab to pick up changes.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim already-open tabs.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "EdgeNiq", body: event.data.text() };
  }
  const title = payload.title || "EdgeNiq alert";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon",
    badge: payload.badge || "/icon",
    tag: payload.tag, // dedupes consecutive alerts on the same ticker
    data: { url: payload.url || "/app" },
    requireInteraction: payload.requireInteraction === true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If a tab is already open, focus it and route there. Otherwise
      // open a fresh one. Avoids spawning duplicate tabs every click.
      for (const client of all) {
        if (client.url.includes(new URL(targetUrl, self.location.origin).pathname)) {
          await client.focus();
          return;
        }
      }
      if (all.length > 0) {
        await all[0].focus();
        await all[0].navigate?.(targetUrl);
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
