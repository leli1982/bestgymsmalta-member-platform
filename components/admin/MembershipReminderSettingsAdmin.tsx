"use client";

import { useEffect, useState } from "react";

type ReminderSettings = {
  enabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  day1Enabled: boolean;
  day7Enabled: boolean;
  day14Enabled: boolean;
  day21Enabled: boolean;
  day30Enabled: boolean;
  updatedAt?: string | null;
};

type RecentReminder = {
  id: string;
  memberNumber: string;
  memberName: string;
  membership_expiry: string;
  days_before: number;
  channel: "email" | "push";
  status: "pending" | "sent" | "skipped" | "failed";
  reason?: string | null;
  error_text?: string | null;
  attempted_at: string;
};

const defaultSettings: ReminderSettings = {
  enabled: false,
  emailEnabled: true,
  pushEnabled: true,
  day1Enabled: true,
  day7Enabled: true,
  day14Enabled: true,
  day21Enabled: true,
  day30Enabled: true,
};

type TimingKey = "day1Enabled" | "day7Enabled" | "day14Enabled" | "day21Enabled" | "day30Enabled";

const timingOptions: Array<{ key: TimingKey; label: string }> = [
  { key: "day1Enabled", label: "1 day" },
  { key: "day7Enabled", label: "1 week" },
  { key: "day14Enabled", label: "2 weeks" },
  { key: "day21Enabled", label: "3 weeks" },
  { key: "day30Enabled", label: "1 month" },
];

export default function MembershipReminderSettingsAdmin() {
  const [settings, setSettings] = useState<ReminderSettings>(defaultSettings);
  const [totals, setTotals] = useState({ sent: 0, skipped: 0, failed: 0 });
  const [recent, setRecent] = useState<RecentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/membership-reminders", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load membership reminder settings.");
      setSettings(data.settings || defaultSettings);
      setTotals(data.totals || { sent: 0, skipped: 0, failed: 0 });
      setRecent(Array.isArray(data.recent) ? data.recent : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load membership reminder settings.");
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
      const response = await fetch("/api/system/membership-reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save membership reminder settings.");
      setSettings(data.settings);
      setMessage(
        data.settings.enabled
          ? "Automatic membership expiry reminders are enabled."
          : "Automatic membership expiry reminders are turned off.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save membership reminder settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm text-sm font-semibold text-zinc-500">Loading membership reminders…</section>;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Membership expiry reminders</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            The system checks memberships daily. Members without an email are skipped for email; app notifications are sent only to members who enabled notifications on their device.
          </p>
        </div>
        <span className={`rounded-full px-3 py-2 text-xs font-black ${settings.enabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
          {settings.enabled ? "AUTOMATIC REMINDERS ON" : "AUTOMATIC REMINDERS OFF"}
        </span>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}

      <label className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-bold">
        Enable automatic expiry reminders
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
          className="h-5 w-5 accent-orange-600"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-semibold">
          Email reminders
          <input type="checkbox" checked={settings.emailEnabled} onChange={(event) => setSettings((current) => ({ ...current, emailEnabled: event.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 text-sm font-semibold">
          Member App notifications
          <input type="checkbox" checked={settings.pushEnabled} onChange={(event) => setSettings((current) => ({ ...current, pushEnabled: event.target.checked }))} />
        </label>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-zinc-800">Send reminders before expiry</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {timingOptions.map((option) => (
            <label key={option.key} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(settings[option.key])}
                onChange={(event) => setSettings((current) => ({ ...current, [option.key]: event.target.checked }))}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save Membership Reminder Settings"}
      </button>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Sent</p><p className="mt-1 text-2xl font-black text-emerald-950">{totals.sent}</p></div>
        <div className="rounded-xl bg-zinc-100 p-4"><p className="text-xs font-black uppercase tracking-wide text-zinc-600">Skipped</p><p className="mt-1 text-2xl font-black text-zinc-950">{totals.skipped}</p></div>
        <div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-red-700">Failed</p><p className="mt-1 text-2xl font-black text-red-950">{totals.failed}</p></div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold">Recent reminder activity</h3>
        {recent.length ? (
          <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-zinc-200">
            {recent.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 text-xs last:border-b-0">
                <div>
                  <p className="font-black text-zinc-900">{item.memberName || item.memberNumber || "Member"}</p>
                  <p className="mt-0.5 font-semibold text-zinc-500">{item.memberNumber} · {item.channel} · {item.days_before === 30 ? "1 month" : `${item.days_before} day${item.days_before === 1 ? "" : "s"}`} before</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-black uppercase ${item.status === "sent" ? "bg-emerald-100 text-emerald-700" : item.status === "failed" ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-600"}`}>{item.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">No reminder activity yet.</p>
        )}
      </div>
    </section>
  );
}
