"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Fingerprint, Laptop, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type Gym = { id: string; name: string; status?: string };
type Terminal = {
  id: string;
  gymId: string;
  name: string;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type TerminalResponse = { terminals: Terminal[]; gyms: Gym[] };

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function StaffTerminalsAdmin() {
  const [data, setData] = useState<TerminalResponse>({ terminals: [], gyms: [] });
  const [name, setName] = useState("");
  const [gymId, setGymId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/system/staff-terminals", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load Punch Clock terminals.");
      setData({ terminals: body.terminals || [], gyms: body.gyms || [] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Punch Clock terminals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeGyms = useMemo(
    () => data.gyms.filter((gym) => !gym.status || String(gym.status).toLowerCase() === "active"),
    [data.gyms],
  );
  const gymNames = useMemo(() => new Map(data.gyms.map((gym) => [gym.id, gym.name])), [data.gyms]);

  async function createTerminal() {
    if (!name.trim() || !gymId) {
      setError("Terminal name and Gym are required.");
      return;
    }
    setBusyId("create"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), gymId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create terminal.");
      setName(""); setGymId("");
      setMessage("Terminal created. Provision this browser on the physical Punch Clock device before use.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create terminal.");
    } finally {
      setBusyId("");
    }
  }

  async function setActive(terminal: Terminal, active: boolean) {
    setBusyId(terminal.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-terminals/${terminal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update terminal.");
      setMessage(active ? "Terminal activated." : "Terminal deactivated.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update terminal.");
    } finally {
      setBusyId("");
    }
  }

  async function provision(terminal: Terminal) {
    const confirmed = window.confirm(
      `Provision this browser as ${terminal.name}? This rotates the protected one-time terminal credential. Only continue on the actual Punch Clock device.`,
    );
    if (!confirmed) return;
    setBusyId(terminal.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-terminals/${terminal.id}/provision`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not provision this browser.");
      setMessage(`${terminal.name} is now provisioned in this browser using a protected cookie.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not provision this browser.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">Attendance hardware</p>
            <h2 className="mt-1 text-2xl font-black">Punch Clock Terminals</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">Register each physical attendance terminal to one Gym. Provisioning writes a protected cookie to this browser, so perform it on the actual Punch Clock device.</p>
          </div>
          <Fingerprint className="h-11 w-11 text-orange-600" />
        </div>

        {error && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}
        {message && <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">{message}</p>}

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-bold">Terminal name<input className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5" value={name} onChange={(event)=>setName(event.target.value)} placeholder="e.g. Tal-Qroqq Reception" /></label>
          <label className="text-sm font-bold">Gym<select className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5" value={gymId} onChange={(event)=>setGymId(event.target.value)}><option value="">Choose Gym</option>{activeGyms.map((gym)=><option key={gym.id} value={gym.id}>{gym.name}</option>)}</select></label>
          <button disabled={busyId === "create"} onClick={()=>void createTerminal()} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Plus className="h-4 w-4"/>Add terminal</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4"><div><h3 className="font-black">Registered terminals</h3><p className="text-sm text-zinc-500">{data.terminals.length} terminal{data.terminals.length === 1 ? "" : "s"}</p></div><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
        {loading ? <p className="p-6 text-sm text-zinc-500">Loading terminals…</p> : data.terminals.length === 0 ? <p className="p-6 text-sm text-zinc-500">No Punch Clock terminals have been registered yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>{["Name","Gym","Status","Last seen","Hardware","Provisioning",""].map((heading)=><th key={heading} className="px-4 py-3 font-black">{heading}</th>)}</tr></thead><tbody>{data.terminals.map((terminal)=><tr key={terminal.id} className="border-t border-zinc-100"><td className="px-4 py-4 font-black">{terminal.name}</td><td className="px-4 py-4">{gymNames.get(terminal.gymId) || terminal.gymId}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${terminal.active ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-600"}`}>{terminal.active ? "Active" : "Inactive"}</span></td><td className="px-4 py-4">{formatDateTime(terminal.lastSeenAt)}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 font-bold text-amber-700"><Laptop className="h-4 w-4"/>Not connected</span><span className="mt-1 block text-xs text-zinc-500">Fingerprint hardware is not configured yet.</span></td><td className="px-4 py-4"><button disabled={busyId === terminal.id || !terminal.active} onClick={()=>void provision(terminal)} className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800 disabled:opacity-50"><ShieldCheck className="h-4 w-4"/>Provision this browser</button><span className="mt-1 block text-xs text-zinc-500">Rotate / Re-provision only on the physical device.</span></td><td className="px-4 py-4"><button disabled={busyId === terminal.id} onClick={()=>void setActive(terminal,!terminal.active)} className="font-black text-orange-700">{terminal.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Hardware status:</strong> Not configured. The application does not provide an employee selector or fallback fingerprint simulation. Until the real reader adapter is installed, the kiosk stays safely locked.</div>
      <a href="/staff/punch-clock" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">Open Punch Clock on this browser →</a>
    </section>
  );
}
