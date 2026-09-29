self.addEventListener("push", (event) => {
  let payload = {
    title: "BestGymsMalta",
    body: "You have a new notification.",
    url: "/more",
    tag: "bgm-member-notification",
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
      data: { url: payload.url || "/more" },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/more", self.location.origin).href;

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
