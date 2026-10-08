"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type Preferences = {
  criticalEnabled: boolean;
  motivationalEnabled: boolean;
};

type PermissionState = NotificationPermission | "unsupported";

const defaultPreferences: Preferences = {
  criticalEnabled: true,
  motivationalEnabled: true,
};

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

function isIosDevice() {
  const navigatorWithTouch = navigator as Navigator & { maxTouchPoints?: number };
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && Number(navigatorWithTouch.maxTouchPoints || 0) > 1);
}

function isStandalonePwa() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches
    || navigatorWithStandalone.standalone === true;
}

export default function MemberReminderNotifications() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [iosOutsidePwa, setIosOutsidePwa] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPreferences() {
      try {
        const response = await fetch("/api/member/notification-preferences", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load notification preferences.");
        if (active) {
          setPreferences(data.preferences || defaultPreferences);
          setPreferencesLoaded(true);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load notification preferences.");
      }
    }

    async function loadDeviceState() {
      const canPush =
        "Notification" in window
        && "serviceWorker" in navigator
        && "PushManager" in window;

      if (!canPush) {
        if (active) {
          setSupported(false);
          setPermission("unsupported");
          setIosOutsidePwa(isIosDevice() && !isStandalonePwa());
        }
        return;
      }

      if (active) setPermission(Notification.permission);
      try {
        const registration = await navigator.serviceWorker.getRegistration("/member-push/");
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setSubscribed(Boolean(subscription));
      } catch {
        if (active) setSubscribed(false);
      }
    }

    void loadPreferences();
    void loadDeviceState();
    return () => { active = false; };
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!supported) throw new Error("This browser does not support push notifications.");

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
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
      setMessage("App notifications are enabled on this device.");
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
        throw new Error("Notification permission is not granted on this device.");
      }

      const registration = await navigator.serviceWorker.getRegistration("/member-push/");
      if (!registration) {
        throw new Error("Member notification service worker is not registered.");
      }
      await waitForActiveWorker(registration);

      await registration.showNotification("BestGymsMalta TEST", {
        body: "If you can see this, your device can display BGM notifications.",
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
      setMessage("Notifications are disabled on this device only.");
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePreference(key: keyof Preferences, value: boolean) {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setPreferenceBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/member/notification-preferences", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update notification preferences.");
      setPreferences(data.preferences || next);
      setMessage("Notification preferences updated for your account.");
    } catch (preferenceError) {
      setPreferences(previous);
      setError(preferenceError instanceof Error ? preferenceError.message : "Could not update notification preferences.");
    } finally {
      setPreferenceBusy(false);
    }
  }

  const permissionLabel = permission === "unsupported"
    ? "Unsupported"
    : permission === "granted"
      ? "Granted"
      : permission === "denied"
        ? "Blocked"
        : "Not granted";

  return (
    <section className="rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${subscribed ? "bg-orange-50 text-[#ff5a0a]" : "bg-zinc-100 text-zinc-600"}`}>
          {subscribed ? <Bell size={25} strokeWidth={3} /> : <BellOff size={25} strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-zinc-950">App notifications</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${subscribed ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
              {subscribed ? "THIS DEVICE ENABLED" : "DEVICE OFF"}
            </span>
          </div>
          <p className="mt-1 text-sm font-bold leading-5 text-zinc-500">
            Control this device separately from the notification categories that apply across your BGM account.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
        <span className={`rounded-full px-3 py-1.5 ${supported ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
          {supported ? "PUSH SUPPORTED" : "PUSH UNSUPPORTED"}
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-600">Permission: {permissionLabel}</span>
      </div>

      {!supported ? (
        <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm font-bold text-zinc-600">
          {iosOutsidePwa ? (
            <p>
              On iPhone or iPad, install BestGymsMalta to your Home Screen first, then open the app from the Home Screen to enable notifications.
            </p>
          ) : (
            <p>Push notifications are not supported by this browser or device.</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void (subscribed ? disableNotifications() : enableNotifications())}
            className={`w-full rounded-full px-5 py-3 text-sm font-black disabled:opacity-50 ${subscribed ? "border border-zinc-300 bg-white text-zinc-800" : "bg-[#ff5a0a] text-white"}`}
          >
            {busy ? "Updating…" : subscribed ? "Disable notifications on this device" : "Enable notifications on this device"}
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

      {subscribed ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div>
            <h4 className="text-sm font-black text-zinc-950">Account notification preferences</h4>
            <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">These settings apply to all devices subscribed to your member account.</p>
          </div>

          <div className="mt-3 grid gap-2">
            <label className="flex items-center justify-between gap-4 rounded-xl bg-white p-3 text-sm font-bold text-zinc-800">
              <span>
                Membership &amp; account reminders
                <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Expiry and other important membership pushes.</span>
              </span>
              <input
                type="checkbox"
                aria-label="Membership & account reminders"
                disabled={!preferencesLoaded || preferenceBusy}
                checked={preferences.criticalEnabled}
                onChange={(event) => void updatePreference("criticalEnabled", event.target.checked)}
                className="h-5 w-5 shrink-0 accent-orange-600"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl bg-white p-3 text-sm font-bold text-zinc-800">
              <span>
                Motivation &amp; streaks
                <span className="mt-0.5 block text-xs font-semibold text-zinc-500">3-day inactivity and streak achievement pushes.</span>
              </span>
              <input
                type="checkbox"
                aria-label="Motivation & streaks"
                disabled={!preferencesLoaded || preferenceBusy}
                checked={preferences.motivationalEnabled}
                onChange={(event) => void updatePreference("motivationalEnabled", event.target.checked)}
                className="h-5 w-5 shrink-0 accent-orange-600"
              />
            </label>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
    </section>
  );
}
