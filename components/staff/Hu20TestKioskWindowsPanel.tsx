"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEuropeanDateTime } from "@/lib/europeanDate";

type Terminal = { id: string; gym_id: string; name: string; active: boolean };
type Window = {
  id: string; terminal_id: string; status: "active" | "cancelled" | "expired";
  created_at: string; expires_at: string; scans_used: number; max_scans: number;
};

export default function Hu20TestKioskWindowsPanel({ terminals }: { terminals: Terminal[] }) {
  const [windows, setWindows] = useState<Window[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/staff-hu20/kiosk", { cache: "no-store" });
      if (response.status === 404) { setAvailable(false); return; }
      const result = await response.json();
      if (!response.ok || result.fictionalTestOnly !== true) throw new Error(result.error || "Cannot load TEST kiosk windows.");
      setWindows(result.windows || []);
      setAvailable(true);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot load TEST kiosk windows.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = windows.filter((w) => w.status === "active" && Date.parse(w.expires_at) > Date.now());
  const terminalNames = new Map(terminals.map((t) => [t.id, t.name]));
  async function send(action: "start" | "stop", id: string) {
    if (!id) { setError("Select a TEST terminal."); return; }
    if (!window.confirm(action === "start"
      ? "Enable fictional TEST automatic fingerprint scanning for 10 minutes (maximum 6 scans)? Normal staff payroll stays disabled."
      : "Stop this TEST kiosk immediately? Any in-progress scan will be rejected.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/kiosk", {
        method: action === "start" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "start" ? { terminalId: id } : { id, action: "stop" }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update TEST kiosk.");
      setMessage(action === "start"
        ? "Fictional TEST kiosk approved for 10 minutes. On the Windows TEST PC, run Hu20-KIOSK-TEST.cmd."
        : "TEST kiosk stopped. Further claims and unconsumed recognitions are blocked.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "TEST kiosk request failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-6 rounded border-2 border-indigo-300 bg-white p-4">
    <h2 className="text-xl font-semibold">Automatic HU20 kiosk — FICTIONAL TEST ONLY</h2>
    <p className="mt-2 text-sm text-slate-700">A Super Admin can authorise one registered Windows TEST terminal for 10 minutes or 6 recognition attempts, whichever comes first. Each attempt is one-time, terminal-bound, recorded and revocable. No real employees, live payroll or normal Staff Punch Clock.</p>
    {available === false && <p className="mt-3 text-sm">Automatic kiosk testing is disabled on this Preview.</p>}
    {error && <p role="alert" className="mt-3 rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}
    {message && <p className="mt-3 rounded bg-green-50 p-3 text-sm font-semibold text-green-900">{message}</p>}
    {available && <>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid min-w-[220px] gap-1 text-sm font-semibold">TEST terminal
          <select value={selectedTerminal} onChange={(e) => setSelectedTerminal(e.target.value)} className="rounded border p-2">
            <option value="">Select registered terminal</option>
            {terminals.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || !selectedTerminal || active.some((w) => w.terminal_id === selectedTerminal)} onClick={() => void send("start", selectedTerminal)} className="rounded bg-indigo-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Start 10-minute TEST kiosk</button>
        <button type="button" disabled={busy} onClick={() => void load()} className="rounded border border-slate-300 px-3 py-2 text-sm">Refresh status</button>
      </div>
      <div className="mt-4 space-y-2">
        {active.length === 0 && <p className="text-sm text-slate-600">No active automatic TEST kiosk windows.</p>}
        {active.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-indigo-200 bg-indigo-50 p-3 text-sm">
          <div>
            <p className="font-semibold">{terminalNames.get(item.terminal_id) || "TEST terminal"} — active</p>
            <p>{item.scans_used}/{item.max_scans} scan attempts · Expires {formatEuropeanDateTime(item.expires_at)}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void send("stop", item.id)} className="rounded bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Stop TEST kiosk now</button>
        </article>)}
      </div>
      <p className="mt-3 text-xs text-slate-600">Use Hu20-KIOSK-TEST.cmd only on the authorised HU20 Windows PC. Stop the session from here or press Ctrl+C on the PC. Fingerprint matching remains NORMAL_TEST_ONLY and must not be used for real staff.</p>
    </>}
  </section>;
}
