"use client";

import { useEffect, useState } from "react";

type Settings = {
  ordersEmail: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  updatedAt?: string | null;
};

type SystemUser = {
  id: string;
  displayName: string;
  isSuperAdmin: boolean;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export default function NotificationSettingsAdmin() {
  const [settings, setSettings] = useState<Settings>({
    ordersEmail: "info@bestgymsmalta.com",
    emailEnabled: true,
    pushEnabled: true,
  });
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("Super Admin phone");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [settingsResponse, authResponse] = await Promise.all([
        fetch("/api/admin/notification-settings", { cache: "no-store" }),
        fetch("/api/system/auth", { cache: "no-store" }),
      ]);

      if (!settingsResponse.ok) {
        throw new Error(
          settingsResponse.status === 401
            ? "Authenticate in BGM Admin or sign in as Super Admin first."
            : "Could not load notification settings."
        );
      }

      const settingsData = await settingsResponse.json();
      const authData = await authResponse.json();
      setSettings(settingsData.settings);

      const user =
        authData.authenticated && authData.user?.isSuperAdmin
          ? authData.user
          : null;
      setSystemUser(user);

      if (user && "serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.register("/staff-sw.js");
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(Boolean(subscription));

        const pushResponse = await fetch("/api/system/push", { cache: "no-store" });
        if (pushResponse.ok) {
          const pushData = await pushResponse.json();
          setPushConfigured(Boolean(pushData.configured));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notification settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save settings.");
      setSettings(data.settings);
      setMessage("Notification settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    setMessage("");
    setError("");

    try {
      if (!systemUser?.isSuperAdmin) {
        throw new Error("Sign in through /staff as Super Admin on this device first.");
      }
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("This browser does not support Web Push notifications.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const initResponse = await fetch("/api/system/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" }),
      });
      const initData = await initResponse.json();
      if (!initResponse.ok || !initData.publicKey) {
        throw new Error(initData.error || "Could not initialise push notifications.");
      }

      const registration = await navigator.serviceWorker.register("/staff-sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(initData.publicKey),
        });
      }

      const subscriptionJson = subscription.toJSON();
      const response = await fetch("/api/system/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          deviceLabel,
          subscription: subscriptionJson,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save push subscription.");

      setPushConfigured(true);
      setPushSubscribed(true);
      setMessage("Push notifications are enabled on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setMessage("");
    setError("");

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/system/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setPushSubscribed(false);
      setMessage("Push notifications are disabled on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-zinc-600">Loading notification settings…</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
            <h1 className="mt-1 text-3xl font-bold">Notifications</h1>
            <p className="mt-2 text-sm text-zinc-600">Configure how new Sundries and Bar orders alert management.</p>
          </div>
          <a href="/bgm-admin/system-users" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">Back to System Users</a>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

        <form onSubmit={saveSettings} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Order alerts</h2>
          <p className="mt-1 text-sm text-zinc-500">Changes apply immediately; no redeployment is required.</p>

          <label className="mt-5 block text-sm font-semibold">
            Order email address
            <input
              required
              type="email"
              value={settings.ordersEmail}
              onChange={(event) => setSettings((current) => ({ ...current, ordersEmail: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
            />
          </label>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-semibold">
              Email alerts
              <input type="checkbox" checked={settings.emailEnabled} onChange={(event) => setSettings((current) => ({ ...current, emailEnabled: event.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-semibold">
              Push alerts
              <input type="checkbox" checked={settings.pushEnabled} onChange={(event) => setSettings((current) => ({ ...current, pushEnabled: event.target.checked }))} />
            </label>
          </div>

          <button disabled={saving} className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save Notification Settings"}
          </button>
        </form>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Push notification device</h2>
              <p className="mt-1 text-sm text-zinc-500">Enable this on the Super Admin phone or any additional management device.</p>
            </div>
            <span className={`rounded-full px-3 py-2 text-xs font-bold ${pushSubscribed ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"}`}>
              {pushSubscribed ? "THIS DEVICE ENABLED" : "NOT ENABLED"}
            </span>
          </div>

          {!systemUser?.isSuperAdmin ? (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              To subscribe this device, first sign in at <a className="font-bold underline" href="/staff">/staff</a> using the Super Admin system login, then return here.
            </div>
          ) : (
            <>
              <label className="mt-5 block max-w-md text-sm font-semibold">
                Device label
                <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3" />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                {!pushSubscribed ? (
                  <button type="button" disabled={pushBusy || !settings.pushEnabled} onClick={enablePush} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                    {pushBusy ? "Enabling…" : "Enable Push on This Device"}
                  </button>
                ) : (
                  <button type="button" disabled={pushBusy} onClick={disablePush} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-40">
                    {pushBusy ? "Updating…" : "Disable Push on This Device"}
                  </button>
                )}
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                Push service: {pushConfigured ? "initialised" : "will initialise automatically on first enable"}.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
