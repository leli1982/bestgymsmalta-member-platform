"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BellRing, RefreshCw, Send, XCircle } from "lucide-react";
import { formatEuropeanDateTime } from "@/lib/europeanDate";

type Gym = { id: string; name: string };
type Recipient = {
  alert_id: string; gym_id: string; gym_name: string;
  read_by: string | null; acknowledged_at: string | null;
  acknowledged_by_system_user_id: string | null;
};
type Alert = {
  id: string; subject: string; message: string; priority: string;
  target_scope: string; created_at: string; cancelled_at: string | null;
  recipients: Recipient[];
};

const field = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold text-zinc-950 focus:border-orange-600 focus:outline-none";

export default function SuperAdminUrgentStaffAlerts() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("urgent");
  const [scope, setScope] = useState("gym");
  const [gymId, setGymId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/system/admin/urgent-staff-alerts", {
      credentials: "same-origin", cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load urgent alerts.");
    setGyms(data.gyms || []);
    setAlerts(data.alerts || []);
  }, []);

  useEffect(() => {
    let active = true;
    load().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load alerts.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (scope === "gym" && !gymId) { setError("Choose a gym."); return; }
    if (!window.confirm(scope === "all"
      ? "Send this internal popup to ALL active staffed gyms?"
      : "Send this internal popup to the selected gym?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/system/admin/urgent-staff-alerts", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", subject, message, priority, scope, gymId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send alert.");
      await load();
      setSubject(""); setMessage("");
      setNotice("Internal staff alert sent. The gym acknowledgement status is shown below.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (busy || !window.confirm("Cancel this urgent notice for every targeted gym?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/system/admin/urgent-staff-alerts", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", alertId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not cancel alert.");
      await load();
      setNotice("Notice cancelled for all recipients.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancellation failed.");
    } finally { setBusy(false); }
  }

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
            <ArrowLeft size={16}/> Super Admin
          </a>
          <div className="mt-4 flex items-center gap-3">
            <BellRing className="text-orange-600" size={32}/>
            <div>
              <h1 className="text-3xl font-black">Urgent Staff Alerts</h1>
              <p className="mt-1 text-sm text-zinc-600">Internal messages to Staff Portals only. Not visible in the Members App.</p>
            </div>
          </div>
        </header>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-orange-50 p-4 font-bold text-orange-800">{notice}</p>}
        {loading ? <p className="rounded-xl bg-white p-5 text-zinc-600">Checking Super Admin access…</p> : (
          <>
            <form onSubmit={send} className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Send internal notice</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-black">Recipients
                  <select aria-label="Recipients" className={field} value={scope} onChange={event => setScope(event.target.value)}>
                    <option value="gym">One gym</option>
                    <option value="all">All active staffed gyms</option>
                  </select>
                </label>
                <label className="text-sm font-black">Priority
                  <select aria-label="Priority" className={field} value={priority} onChange={event => setPriority(event.target.value)}>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </label>
              </div>
              {scope === "gym" && (
                <label className="block text-sm font-black">Choose gym
                  <select aria-label="Choose gym" required className={field} value={gymId} onChange={event => setGymId(event.target.value)}>
                    <option value="">Select a gym…</option>
                    {gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-sm font-black">Subject
                <input className={field} required maxLength={160} value={subject}
                  onChange={event => setSubject(event.target.value)} placeholder="Short notice title"/>
              </label>
              <label className="block text-sm font-black">Message
                <textarea className={field} required maxLength={4000} rows={6} value={message}
                  onChange={event => setMessage(event.target.value)} placeholder="Write the instruction for reception staff…"/>
              </label>
              <button disabled={busy || gyms.length === 0 || !subject.trim() || !message.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-black text-white disabled:opacity-50">
                <Send size={17}/> {busy ? "Sending…" : "Send urgent alert"}
              </button>
            </form>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black">Sent alerts</h2>
                <button type="button" disabled={busy} onClick={() => {
                  setError(""); setNotice("");
                  void load().catch(cause => setError(String(cause)));
                }} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 font-bold">
                  <RefreshCw size={16}/> Refresh
                </button>
              </div>
              {alerts.length === 0 && <p className="rounded-xl bg-white p-5 text-zinc-600">No staff alerts have been sent.</p>}
              {alerts.map(alert => {
                const acknowledged = alert.recipients.filter(recipient => Boolean(recipient.acknowledged_at)).length;
                return (
                  <article key={alert.id} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-orange-700">
                          {alert.priority} · {alert.target_scope === "all" ? "All gyms" : "Selected gym"}
                          {alert.cancelled_at ? " · Cancelled" : ""}
                        </p>
                        <h3 className="mt-1 text-xl font-black">{alert.subject}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{alert.message}</p>
                        <p className="mt-2 text-xs text-zinc-500">Sent {formatEuropeanDateTime(alert.created_at)}</p>
                      </div>
                      <div className="text-sm font-black">{acknowledged} / {alert.recipients.length} acknowledged</div>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-100 text-zinc-700"><tr>
                          <th className="p-3">Gym</th><th className="p-3">Status</th>
                          <th className="p-3">Read by</th><th className="p-3">Acknowledged at</th>
                        </tr></thead>
                        <tbody>
                          {alert.recipients.map(recipient => (
                            <tr key={recipient.gym_id} className="border-t border-zinc-100">
                              <td className="p-3 font-bold">{recipient.gym_name}</td>
                              <td className="p-3">{recipient.acknowledged_at ? "Acknowledged" : alert.cancelled_at ? "Cancelled" : "Awaiting acknowledgement"}</td>
                              <td className="p-3">{recipient.read_by || "—"}</td>
                              <td className="p-3">{recipient.acknowledged_at ? formatEuropeanDateTime(recipient.acknowledged_at) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!alert.cancelled_at && <button type="button" disabled={busy} onClick={() => void cancel(alert.id)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">
                      <XCircle size={16}/> Cancel this notice
                    </button>}
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
