"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; first_name: string; surname: string; active: boolean };
type Terminal = { id: string; name: string; gym_id: string; active: boolean };
type Enrollment = {
  id: string; employee_id: string; terminal_id: string;
  status: "pending" | "completed" | "cancelled" | "expired";
  created_at: string; expires_at: string;
};
type Loaded = {
  ok: boolean; employees: Employee[]; terminals: Terminal[];
  requests: Enrollment[]; error?: string; note?: string;
};

export default function Hu20TestEnrollmentPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/system/staff-hu20/enrollments", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Cannot load TEST enrollments.");
    setData(result as Loaded);
  }, []);

  useEffect(() => {
    void load().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Cannot load TEST enrollments.");
    });
  }, [load]);
  const employeeNames = useMemo(() => new Map((data?.employees || []).map(
    (employee) => [employee.id, [employee.first_name, employee.surname].join(" ")]
  )), [data?.employees]);
  const terminalNames = useMemo(() => new Map((data?.terminals || []).map(
    (terminal) => [terminal.id, terminal.name]
  )), [data?.terminals]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/enrollments", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, terminalId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cannot create enrollment request.");
      setMessage("TEST authorization created for 5 minutes. Fingerprint upload remains disabled.");
      setEmployeeId("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot create enrollment request.");
    } finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/enrollments", {
        method: "PATCH", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cannot cancel enrollment request.");
      setMessage("Pending TEST authorization cancelled.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot cancel enrollment request.");
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl p-5 text-slate-900">
    <a href="/staff/admin/staff/terminals" className="underline">Back to HU20 terminals</a>
    <h1 className="mt-4 text-2xl font-bold">Supervised HU20 enrollment — TEST</h1>
    <p className="mt-2 text-sm">Select an employee and registered HU20 terminal to authorise a five-minute enrollment window. This stage does not scan, upload, or store fingerprints and cannot record attendance.</p>
    {error && <p role="alert" className="mt-3 rounded bg-red-100 p-3 text-red-900">{error}</p>}
    {message && <p role="status" className="mt-3 rounded bg-blue-50 p-3 text-blue-900">{message}</p>}
    <form className="mt-5 grid gap-4 rounded border bg-white p-4" onSubmit={submit}>
      <label className="grid gap-1">Employee
        <select className="rounded border p-2" required value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
          <option value="">Choose active employee</option>
          {(data?.employees || []).filter(item => item.active).map(item =>
            <option key={item.id} value={item.id}>{item.first_name} {item.surname}</option>
          )}
        </select>
      </label>
      <label className="grid gap-1">HU20 terminal
        <select className="rounded border p-2" required value={terminalId} onChange={event => setTerminalId(event.target.value)}>
          <option value="">Choose active TEST terminal</option>
          {(data?.terminals || []).filter(item => item.active).map(item =>
            <option key={item.id} value={item.id}>{item.name} ({item.gym_id})</option>
          )}
        </select>
      </label>
      <button type="submit" disabled={busy || !employeeId || !terminalId}
        className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Saving…" : "Authorise TEST enrollment"}
      </button>
    </form>
    <h2 className="mt-6 text-xl font-semibold">Recent enrollment requests</h2>
    <div className="mt-3 grid gap-3">
      {(data?.requests || []).map(item =>
        <article key={item.id} className="rounded border bg-white p-3">
          <p className="font-semibold">{employeeNames.get(item.employee_id) || "Employee"} — {terminalNames.get(item.terminal_id) || "Terminal"}</p>
          <p className="text-sm">Status: {item.status} · Expires: {new Date(item.expires_at).toLocaleString("en-MT")}</p>
          {item.status === "pending" && <button type="button" disabled={busy}
            onClick={() => { void cancel(item.id); }}
            className="mt-2 rounded border border-slate-500 px-3 py-1 text-sm disabled:opacity-50">
            Cancel request
          </button>}
        </article>
      )}
      {data?.requests.length === 0 && <p className="text-sm text-slate-600">No TEST requests yet.</p>}
    </div>
  </main>;
}
