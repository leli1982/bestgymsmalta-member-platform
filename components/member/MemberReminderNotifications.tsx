"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData.split("").map((character) => character.charCodeAt(0)));
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration) {
  if (registration.active) return;
  const worker = registration.installing || registration.waiting;
  if (!worker) return;
  await new Promise<void>((resolve) => {
    if (worker.state === "activated") {
      resolve();
      return;
    }
    const onStateChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      }
    };
    worker.addEventListener("statechange", onStateChange);
  });
}

export default function MemberReminderNotifications() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (active) setSupported(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/member-push/");
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setSubscribed(Boolean(subscription));
      } catch {
        if (active) setSubscribed(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!supported) throw new Error("This browser does not support push notifications.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const initResponse = await fetch("/api/member/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" }),
      });
      const initData = await initResponse.json().catch(() => ({}));
      if (!initResponse.ok || !initData.publicKey) {
        throw new Error(initData.error || "Could not initialise member notifications.");
      }

      const registration = await navigator.serviceWorker.register("/member-push-sw.js", {
        scope: "/member-push/",
      });
      await waitForActiveWorker(registration);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(initData.publicKey),
        });
      }

      const response = await fetch("/api/member/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          deviceLabel: "Member app device",
          subscription: subscription.toJSON(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save notification subscription.");

      setSubscribed(true);
      setMessage("Membership reminder notifications are enabled on this device.");
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function testLocalNotification() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!supported) throw new Error("This browser does not support notifications.");
      if (Notification.permission !== "granted") {
        throw new Error("Chrome notification permission is not granted.");
      }

      const registration = await navigator.serviceWorker.getRegistration("/member-push/");
      if (!registration) {
        throw new Error("Member notification service worker is not registered.");
      }
      await waitForActiveWorker(registration);

      await registration.showNotification("BestGymsMalta TEST", {
        body: "If you can see this, Chrome and your computer can display BGM notifications.",
        icon: "/bgm-logo.png",
        badge: "/bgm-logo.png",
        tag: "bgm-member-local-test-" + Date.now(),
        data: { url: "/member-login" },
      });

      setMessage("Local test notification requested on this device.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Could not show local test notification.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.getRegistration("/member-push/");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch("/api/member/push", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not disable member notifications.");
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      setMessage("Membership reminder notifications are disabled on this device.");
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${subscribed ? "bg-orange-50 text-[#ff5a0a]" : "bg-zinc-100 text-zinc-600"}`}>
          {subscribed ? <Bell size={25} strokeWidth={3} /> : <BellOff size={25} strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-zinc-950">Membership reminders</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${subscribed ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
              {subscribed ? "ENABLED" : "OFF"}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold leading-5 text-zinc-500">
            Allow BestGymsMalta to remind you on this device before your membership expires.
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm font-bold text-zinc-600">
          Push notifications are not supported by this browser.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (subscribed ? disableNotifications() : enableNotifications())}
            className={`w-full rounded-full px-5 py-3 text-sm font-black disabled:opacity-50 ${subscribed ? "border border-zinc-300 bg-white text-zinc-800" : "bg-[#ff5a0a] text-white"}`}
          >
            {busy ? "Updating…" : subscribed ? "Disable reminders on this device" : "Enable app reminders"}
          </button>
          {subscribed ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void testLocalNotification()}
              className="w-full rounded-full border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-black text-[#ff5a0a] disabled:opacity-50"
            >
              Test notification on this device
            </button>
          ) : null}
        </div>
      )}

      {message ? <p className="mt-3 text-xs font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
    </section>
  );
}
