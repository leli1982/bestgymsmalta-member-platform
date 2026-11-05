"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert, WifiOff } from "lucide-react";
import { formatEuropeanDateTime } from "@/lib/europeanDate";
import { createStaffRealtimeClient } from "@/lib/supabaseStaffBrowser";

type PendingAlert = {
  id: string; subject: string; message: string; priority: "urgent" | "emergency";
  created_at: string; revision: number;
};
type RealtimeConfig = { enabled: false } | {
  enabled: true; topic: string; supabaseUrl: string; publishableKey: string;
};

/**
 * Staff-only modal, mounted in /staff/layout.tsx and never in the Members App.
 * Its z-index is deliberately BELOW StaffGlobalScanner's 1000/1001 scan dialogs.
 * A hardware card scan can cover the alert and, when resolved, reveal the same
 * still-mounted alert with the entered name unchanged. Scanning cannot ACK it.
 */
export default function UrgentStaffAlertOverlay() {
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [readBy, setReadBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const currentId = alerts[0]?.id ?? null;
  const previousId = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/staff/urgent-alerts", {
        credentials: "same-origin", cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        setAlerts([]);
        setOffline(false);
        setError("");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to check staff notices.");
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setOffline(false);
      setError("");
    } catch {
      // Keep the current alert rendered. Never treat disconnection as acknowledgement.
      setOffline(true);
      setError("Connection unavailable. This notice will stay open until the acknowledgement is saved.");
    }
  }, []);

  useEffect(() => {
    if (previousId.current !== currentId) {
      previousId.current = currentId;
      setReadBy("");
      setError("");
    }
  }, [currentId]);

  useEffect(() => {
    const refresh = () => void load();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("bgm-staff-auth-changed", refresh);
    document.addEventListener("visibilitychange", visible);
    refresh();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("bgm-staff-auth-changed", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let cleanup: (() => void) | null = null;
    const connect = async () => {
      const generationAtStart = ++generation;
      cleanup?.();
      cleanup = null;
      try {
        const response = await fetch("/api/system/staff/urgent-alerts/realtime", {
          cache: "no-store", credentials: "same-origin",
        });
        if (!response.ok) return;
        const config = (await response.json()) as RealtimeConfig;
        if (disposed || generation !== generationAtStart || !config.enabled) return;
        const client = createStaffRealtimeClient(config.supabaseUrl, config.publishableKey);
        const channel = client.channel(config.topic)
          .on("broadcast", { event: "urgent-staff-alert-changed" }, () => void load())
          .subscribe();
        cleanup = () => { void client.removeChannel(channel); };
      } catch {
        // Realtime is best-effort; 15-second polling, focus and login recover alerts.
      }
    };
    const reconnect = () => { void connect(); };
    window.addEventListener("bgm-staff-auth-changed", reconnect);
    void connect();
    return () => {
      disposed = true; generation++;
      window.removeEventListener("bgm-staff-auth-changed", reconnect);
      cleanup?.();
    };
  }, [load]);

  async function acknowledge() {
    const alert = alerts[0];
    if (!alert || busy || !readBy.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/system/staff/urgent-alerts", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id, readBy: readBy.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Acknowledgement failed.");
      // Only a confirmed database acknowledgement can dismiss this alert.
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Acknowledgement not confirmed.");
      setOffline(!navigator.onLine);
    } finally {
      setBusy(false);
    }
  }

  const active = alerts[0];
  if (!active) return null;
  const emergency = active.priority === "emergency";

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Urgent internal staff alert"
      data-testid="urgent-staff-alert"
      className="fixed inset-0 z-[950] flex items-center justify-center overflow-y-auto bg-zinc-950/85 px-4 py-6 text-zinc-950"
    >
      <section className="w-full max-w-xl rounded-3xl border-4 border-orange-500 bg-white p-6 shadow-2xl sm:p-8">
        <header className="flex items-center gap-3">
          <span className={emergency ? "rounded-2xl bg-red-100 p-3 text-red-700" : "rounded-2xl bg-orange-100 p-3 text-orange-700"}>
            {emergency ? <ShieldAlert size={30}/> : <AlertTriangle size={30}/>}
          </span>
          <div>
            <p className={emergency ? "text-sm font-black uppercase tracking-wide text-red-700" : "text-sm font-black uppercase tracking-wide text-orange-700"}>
              {emergency ? "Emergency — Staff Only" : "Urgent Notice — Staff Only"}
            </p>
            <h2 className="mt-1 text-2xl font-black">{active.subject}</h2>
          </div>
        </header>

        <p className="mt-4 text-xs font-semibold text-zinc-500">
          Sent {formatEuropeanDateTime(active.created_at)} · Notice {alerts.length > 1 ? "1 of " + alerts.length : "1 of 1"}
        </p>
        <div className="mt-4 max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-zinc-100 p-5 text-base leading-7 font-semibold text-zinc-900">
          {active.message}
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-600">
          A member card scan takes priority. When the scan finishes, this notice returns unchanged.
        </p>
        <form onSubmit={(event) => { event.preventDefault(); void acknowledge(); }} className="mt-5">
          <label htmlFor="bgm-urgent-alert-readby" className="block text-base font-black">
            Read by <span className="text-red-600">*</span>
          </label>
          <input id="bgm-urgent-alert-readby" type="text" required maxLength={100}
            autoComplete="name" value={readBy} onChange={event => setReadBy(event.target.value)}
            placeholder="Type your full name"
            className="mt-2 w-full rounded-xl border-2 border-zinc-400 bg-white px-4 py-3 text-lg font-semibold text-zinc-950 focus:border-orange-600 focus:outline-none"
          />
          {(error || offline) && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
              <WifiOff size={18} className="shrink-0"/> {error || "Offline: acknowledgement is not yet recorded."}
            </p>
          )}
          <button type="submit" disabled={busy || !readBy.trim()}
            className="mt-4 w-full rounded-xl bg-orange-600 px-5 py-4 text-lg font-black text-white disabled:opacity-50">
            {busy ? "Saving acknowledgement…" : "Acknowledge & Close"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs font-semibold text-zinc-500">
          This notice cannot be closed until your name and acknowledgement are saved.
        </p>
      </section>
    </div>
  );
}
