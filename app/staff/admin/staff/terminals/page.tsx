"use client";

import { useCallback, useEffect, useState } from "react";

type Terminal = {
  id: string; gym_id: string; name: string; active: boolean;
  vendor: string | null; model: string | null;
  created_at: string; last_seen_at: string | null;
};
type Gym = { id: string; name: string; status: string };
type ResponseData = { terminals: Terminal[]; gyms: Gym[]; error?: string };
type Credential = { id: string; name: string; secret: string };

export default function Hu20TestTerminalsPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [gymId, setGymId] = useState("");
  const [name, setName] = useState("");
  const [credential, setCredential] = useState<Credential | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/staff-hu20/terminals", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load terminals.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load terminals.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createTerminal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setCredential(null);
    setError("");
    try {
      const response = await fetch("/api/system/staff-hu20/terminals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, name }),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not register terminal.");
      setCredential({ id: body.terminal.id, name: body.terminal.name, secret: body.terminalSecret });
      setName("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not register terminal.");
    } finally {
      setBusy(false);
    }
  }

  const activeGyms = (data?.gyms || []).filter((gym) => gym.status === "active");
  const gymNames = new Map((data?.gyms || []).map((gym) => [gym.id, gym.name]));

  return (
    <main className="mx-auto max-w-3xl p-5 text-slate-900">
      <a href="/staff/admin/staff" className="underline">Back to Staff management</a>
      <h1 className="mt-4 text-2xl font-bold">HU20 Punch Clock terminals — TEST</h1>
      <p className="mt-2"><a href="/staff/admin/staff/terminals/enrollment" className="font-semibold underline">Supervised TEST enrollment requests</a></p>
      <p className="mt-2 text-sm">Register a gym PC for secure communication tests. Fingerprint attendance and payroll changes remain disabled.</p>
      {error && <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-900">{error}</p>}
      <form onSubmit={createTerminal} className="mt-5 grid gap-3 rounded border bg-white p-4">
        <label className="grid gap-1">Gym
          <select required className="rounded border p-2" value={gymId} onChange={(e) => setGymId(e.target.value)}>
            <option value="">Select active TEST gym</option>
            {activeGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Terminal label
          <input required minLength={3} maxLength={100} className="rounded border p-2" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Kirkop reception PC 1"/>
        </label>
        <button disabled={busy || activeGyms.length === 0}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" type="submit">
          {busy ? "Registering…" : "Register TEST terminal"}
        </button>
        {activeGyms.length === 0 && <p className="text-sm">Add an active gym to TEST before registering a terminal.</p>}
      </form>
      {credential && <section className="mt-5 rounded border-2 border-amber-400 bg-amber-50 p-4">
        <h2 className="font-bold">One-time terminal credential — save securely now</h2>
        <p className="mt-2 text-sm">This secret will not be shown again. Do not paste it into chat, screenshots, email or the shared USB installer.</p>
        <p className="mt-3 text-sm">Terminal ID</p>
        <code className="block break-all rounded bg-white p-2">{credential.id}</code>
        <p className="mt-3 text-sm">Terminal secret</p>
        <code className="block break-all rounded bg-white p-2">{credential.secret}</code>
        <button onClick={() => setCredential(null)} className="mt-4 rounded bg-slate-900 px-3 py-2 text-white" type="button">I have saved it — hide credential</button>
      </section>}
      <h2 className="mt-6 text-xl font-semibold">Registered terminals</h2>
      <div className="mt-2 grid gap-2">{(data?.terminals || []).map((item) => <article key={item.id} className="rounded border bg-white p-3">
        <p className="font-semibold">{item.name} — {gymNames.get(item.gym_id) || item.gym_id}</p>
        <p className="text-sm">Status: {item.active ? "Active (TEST)" : "Inactive"} · Last connection: {item.last_seen_at ? new Date(item.last_seen_at).toLocaleString("en-MT") : "Not connected"}</p>
        <code className="text-xs">{item.id}</code>
      </article>)}</div>
    </main>
  );
}
