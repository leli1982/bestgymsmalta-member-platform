const CACHE_NAME = "bgm-staff-shell-v5";
const AUTH_CACHE_NAME = "bgm-staff-auth-v1";
const BAR_API_CACHE_NAME = "bgm-staff-bar-api-v1";
const AUTH_TTL_MS = 24 * 60 * 60 * 1000;
const STAFF_ROUTES = [
  "/staff",
  "/staff/offline",
  "/staff/members/enroll",
  "/staff/bar",
  "/manifest.json",
  "/bgm-logo.png",
];

const authRequest = () => new Request(new URL("/api/system/auth", self.location.origin).href, { method: "GET" });

async function clearCachedAuth() {
  const cache = await caches.open(AUTH_CACHE_NAME);
  await cache.delete(authRequest());
}

async function cacheAuthPayload(payload, response) {
  if (!response.ok || !payload?.authenticated || !payload?.user || payload.user.isSuperAdmin || payload.user.role === "super_admin") {
    await clearCachedAuth();
    return;
  }
  const headers = new Headers(response.headers);
  headers.set("x-bgm-cached-at", String(Date.now()));
  const cached = new Response(JSON.stringify(payload), {
    status: 200,
    headers,
  });
  const cache = await caches.open(AUTH_CACHE_NAME);
  await cache.put(authRequest(), cached);
}

async function getCachedAuth() {
  const cache = await caches.open(AUTH_CACHE_NAME);
  const cached = await cache.match(authRequest());
  if (!cached) return null;
  const cachedAt = Number(cached.headers.get("x-bgm-cached-at") || 0);
  if (!cachedAt || Date.now() - cachedAt > AUTH_TTL_MS) {
    await cache.delete(authRequest());
    return null;
  }
  return cached;
}

async function networkFirstApi(request) {
  const cache = await caches.open(BAR_API_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STAFF_ROUTES)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => ![CACHE_NAME, AUTH_CACHE_NAME, BAR_API_CACHE_NAME].includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "BestGymsMalta",
    body: "You have a new notification.",
    url: "/staff",
    tag: "bgm-notification",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/bgm-logo.png",
      badge: "/bgm-logo.png",
      tag: payload.tag,
      data: { url: payload.url || "/staff" },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/staff", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          if ("navigate" in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/system/auth") {
    if (request.method === "GET") {
      event.respondWith((async () => {
        try {
          const response = await fetch(request);
          const payload = await response.clone().json().catch(() => null);
          await cacheAuthPayload(payload, response);
          return response;
        } catch {
          return (await getCachedAuth()) || Response.error();
        }
      })());
      return;
    }

    if (request.method === "DELETE") {
      event.respondWith((async () => {
        await clearCachedAuth();
        return fetch(request);
      })());
      return;
    }

    if (request.method === "POST") {
      event.respondWith((async () => {
        const response = await fetch(request);
        const payload = await response.clone().json().catch(() => null);
        await cacheAuthPayload(payload, response);
        return response;
      })());
      return;
    }
  }

  if (request.method !== "GET") return;

  if (
    url.pathname === "/api/gyms" ||
    url.pathname === "/api/system/bar/catalog" ||
    url.pathname === "/api/system/bar/today"
  ) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/staff")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match("/staff/offline")) ||
            Response.error()
          );
        })
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/bgm-logo.png"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
