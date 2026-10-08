"use client";

import { useEffect, useState } from "react";

type EngagementSettings = {
  enabled: boolean;
  inactivityEnabled: boolean;
  streakEnabled: boolean;
  updatedAt?: string | null;
};

const defaults: EngagementSettings = {
  enabled: false,
  inactivityEnabled: true,
  streakEnabled: true,
};

export default function MemberEngagementSettingsAdmin() {
  const [settings, setSettings] = useState<EngagementSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/member-engagement-settings", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load member engagement settings.");
      setSettings(data.settings || defaults);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load member engagement settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/system/member-engagement-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save member engagement settings.");
      setSettings(data.settings);
      setMessage(data.settings.enabled
        ? "Member engagement notifications are enabled."
        : "Member engagement notifications remain disabled.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save member engagement settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm font-semibold text-zinc-500 shadow-sm">Loading member engagement notifications…</section>;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Member engagement notifications</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Controls motivational inactivity and streak pushes only. Membership expiry reminders remain managed separately above.
          </p>
        </div>
        <span className={`rounded-full px-3 py-2 text-xs font-black ${settings.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
          {settings.enabled ? "ENGAGEMENT ON" : "ENGAGEMENT OFF"}
        </span>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}

      <div className="mt-5 grid gap-3">
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-bold">
          <span>
            Global engagement
            <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Master switch for motivational notifications.</span>
          </span>
          <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5 accent-orange-600" />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-bold">
          <span>
            Inactivity notifications
            <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Remind eligible members after exactly 3 complete Malta calendar days away.</span>
          </span>
          <input type="checkbox" checked={settings.inactivityEnabled} onChange={(event) => setSettings((current) => ({ ...current, inactivityEnabled: event.target.checked }))} className="h-5 w-5 accent-orange-600" />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-bold">
          <span>
            Streak notifications
            <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Celebrate 3, 5, 7, 14 and 30-day attendance streaks.</span>
          </span>
          <input type="checkbox" checked={settings.streakEnabled} onChange={(event) => setSettings((current) => ({ ...current, streakEnabled: event.target.checked }))} className="h-5 w-5 accent-orange-600" />
        </label>
      </div>

      <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save Engagement Settings"}
      </button>
    </section>
  );
}
