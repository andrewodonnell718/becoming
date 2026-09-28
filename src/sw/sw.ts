/// <reference lib="webworker" />
// Service worker: offline precache, background-video cache, and reminder notifications.
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// The background video is cached on first play rather than precached.
registerRoute(
  ({ url }) => url.pathname.endsWith('.mp4'),
  new CacheFirst({ cacheName: 'media', plugins: [new RangeRequestsPlugin(), new ExpirationPlugin({ maxEntries: 2 })] }),
);

interface ReminderPayload { title: string; body: string; url?: string; tag?: string }

self.addEventListener('push', (event) => {
  let data: ReminderPayload = { title: 'Becoming', body: '' };
  try {
    data = { ...data, ...(event.data?.json() as ReminderPayload) };
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: new URL('icons/icon-192.png', self.registration.scope).href,
      badge: new URL('icons/icon-192.png', self.registration.scope).href,
      data: { url: data.url ?? '' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Reminder links are relative ("?open=morning"), resolved against wherever the app is hosted.
  const url = new URL((event.notification.data?.url as string) ?? '', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: 'open', url });
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
