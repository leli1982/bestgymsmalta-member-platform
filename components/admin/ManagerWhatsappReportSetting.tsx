"use client";

import { useEffect, useState } from "react";

export default function ManagerWhatsappReportSetting({
  managerUserId,
  managerUsername,
  disabled = false,
}: {
  managerUserId: string;
  managerUsername: string;
  disabled?: boolean;
}) {
  const [reportWhatsappNumber, setReportWhatsappNumber] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/manager-report-settings?managerUserId=${encodeURIComponent(managerUserId)}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load WhatsApp report settings.");
        if (!cancelled) {
          const value = data.reportWhatsappNumber ? `+${data.reportWhatsappNumber}` : "";
          setReportWhatsappNumber(value);
          setSavedValue(value);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load WhatsApp report settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [managerUserId]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/manager-report-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerUserId, reportWhatsappNumber }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save WhatsApp report settings.");
      const value = data.reportWhatsappNumber ? `+${data.reportWhatsappNumber}` : "";
      setReportWhatsappNumber(value);
      setSavedValue(value);
      setMessage(value ? "WhatsApp report recipient saved." : "WhatsApp report recipient cleared.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save WhatsApp report settings.");
    } finally {
      setSaving(false);
    }
  }

  const changed = reportWhatsappNumber.trim() !== savedValue;

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
      <p className="text-sm font-black text-emerald-950">WhatsApp report delivery</p>
      <p className="mt-1 text-xs leading-5 text-emerald-800">Only Super Admin controls this recipient. The Gym Manager can send the report currently visible on their dashboard to this number.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-sm font-bold text-zinc-900">Send reports to
          <input
            aria-label={`${managerUsername} report WhatsApp number`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={reportWhatsappNumber}
            onChange={(event) => setReportWhatsappNumber(event.target.value)}
            disabled={loading || saving || disabled}
            placeholder="+356 7900 0000"
            className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 disabled:opacity-60"
          />
          <span className="mt-1 block text-xs font-normal text-zinc-600">Include the country code. Leave blank to disable WhatsApp report sending.</span>
        </label>
        <button
          type="button"
          disabled={!changed || loading || saving || disabled}
          onClick={() => void save()}
          className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
        >{saving ? "Saving…" : "Save WhatsApp recipient"}</button>
      </div>
      {message && <p role="status" className="mt-2 text-sm font-bold text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}
