"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; first_name: string; surname: string; active: boolean };
type Terminal = { id: string; name: string; gym_id: string; active: boolean };
type Enrollment = {
  id: string; employee_id: string; terminal_id: string;
  status: "pending" | "completed" | "cancelled" | "expired";
  created_at: string; expires_at: string;
};
type RecognitionTest = { id: string; terminal_id: string; status: string; created_at: string; expires_at: string; result: string | null };
type Biometric = { id: string; employee_id: string; enrolled_at: string; active: boolean; status: string };
type Loaded = {
  ok: boolean; employees: Employee[]; terminals: Terminal[];
  requests: Enrollment[]; error?: string; note?: string;
};

export default function Hu20TestEnrollmentPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [biometrics, setBiometrics] = useState<Biometric[]>([]);
  const [recognitionTests, setRecognitionTests] = useState<RecognitionTest[]>([]);
  const [recognitionTerminalId, setRecognitionTerminalId] = useState("");
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
    const biometricResponse = await fetch("/api/system/staff-hu20/biometrics", { cache: "no-store" });
    const biometricsBody = await biometricResponse.json();
    if (!biometricResponse.ok) throw new Error(biometricsBody.error || "Cannot load biometric status.");
    setBiometrics(biometricsBody.biometrics || []);
    const scanResponse = await fetch("/api/system/staff-hu20/recognition", { cache: "no-store" });
    const scanResult = await scanResponse.json();
    if (!scanResponse.ok) throw new Error(scanResult.error || "Cannot load recognition tests.");
    setRecognitionTests(scanResult.tests || []);
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
      setMessage("TEST enrollment authorised for 10 minutes. The registered scanner can upload only after two matching fingerprint captures.");
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
  async function revoke(id: string) {
    if (!window.confirm("Revoke this TEST fingerprint? Encrypted template data will be erased and cannot be recovered.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/biometrics", {
        method: "PATCH", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "revoke" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke fingerprint.");
      setMessage("TEST fingerprint revoked and encrypted template erased.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke fingerprint.");
    } finally { setBusy(false); }
  }
  async function authoriseRecognition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/recognition", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalId: recognitionTerminalId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cannot authorise recognition.");
      setMessage("TEST recognition authorised for five minutes. Run Hu20-CentralRecognise.ps1 at the terminal.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot authorise recognition.");
    } finally { setBusy(false); }
  }
  async function cancelRecognition(id: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-hu20/recognition", {
        method: "PATCH", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Cannot cancel recognition test.");
      setMessage("Pending recognition test cancelled.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cannot cancel recognition.");
    } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl p-5 text-slate-900">
    <a href="/staff/admin/staff/terminals" className="underline">Back to HU20 terminals</a>
    <h1 className="mt-4 text-2xl font-bold">Supervised HU20 enrollment — TEST</h1>
    <p className="mt-2 text-sm">Select an employee and registered HU20 terminal to authorise a ten-minute enrollment window. The browser does not capture or store fingerprints; the supervised Windows HU20 scanner uploads only after two matching scans. No attendance is recorded.</p>
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
    <h2 className="mt-7 text-xl font-semibold">Active HU20 TEST fingerprint enrollments</h2>
    <p className="mt-1 text-sm text-slate-600">Only status information is shown here. Fingerprint templates cannot be viewed in the browser.</p>
    <div className="mt-3 grid gap-3">
      {biometrics.map(item => <article key={item.id} className="rounded border bg-white p-3">
        <p className="font-semibold">{employeeNames.get(item.employee_id) || "Employee"}</p>
        <p className="text-sm">Enrolled: {new Date(item.enrolled_at).toLocaleString("en-MT")}</p>
        <button type="button" disabled={busy} onClick={() => { void revoke(item.id); }}
          className="mt-2 rounded border border-red-700 px-3 py-1 text-sm text-red-800 disabled:opacity-50">
          Revoke and erase TEST fingerprint
        </button>
      </article>)}
      {biometrics.length === 0 && <p className="text-sm text-slate-600">No active TEST fingerprints enrolled.</p>}
    </div>
    <section className="mt-8 border-t pt-6">
      <h2 className="text-xl font-semibold">Central fingerprint recognition — TEST only</h2>
      <p className="mt-1 text-sm">Authorise a one-time, five-minute recognition test on an active HU20 terminal. Only fictional TEST employees are included. No attendance or payroll is recorded.</p>
      <form className="mt-4 grid gap-3 rounded border bg-white p-4" onSubmit={authoriseRecognition}>
        <label className="grid gap-1">Scanner terminal
          <select className="rounded border p-2" required value={recognitionTerminalId}
            onChange={event => setRecognitionTerminalId(event.target.value)}>
            <option value="">Choose active TEST terminal</option>
            {(data?.terminals || []).filter(item => item.active).map(item =>
              <option key={item.id} value={item.id}>{item.name} ({item.gym_id})</option>
            )}
          </select>
        </label>
        <button type="submit" disabled={busy || !recognitionTerminalId}
          className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Authorise one fingerprint recognition TEST"}
        </button>
      </form>
      <h3 className="mt-5 font-semibold">Recent recognition tests</h3>
      <div className="mt-3 grid gap-2">
        {recognitionTests.map(item => <article key={item.id} className="rounded border p-3 text-sm">
          <p>{terminalNames.get(item.terminal_id) || "Terminal"} — <strong>{item.status}</strong></p>
          <p>Created: {new Date(item.created_at).toLocaleString("en-MT")}</p>
          {item.result && <p>Result: {item.result}</p>}
          {item.status === "pending" && <button type="button" disabled={busy}
            onClick={() => { void cancelRecognition(item.id); }}
            className="mt-2 rounded border px-3 py-1 disabled:opacity-50">Cancel test</button>}
        </article>)}
        {recognitionTests.length === 0 && <p className="text-sm text-slate-600">No recognition tests yet.</p>}
      </div>
    </section>
  </main>;
}
