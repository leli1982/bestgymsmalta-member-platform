"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";
import { europeanDateFromIso, formatEuropeanDate, parseEuropeanDate } from "@/lib/europeanDate";

type Version = {
  id: string; version_no: number; name: string; full_time_multiplier_bps: number;
  part_time_multiplier_bps: number; active: boolean; note: string | null;
  effective_created_at: string; superseded_at: string | null; created_at: string;
};
type Holiday = { id: string; holidayDate: string; currentVersion: Version | null; versions: Version[] };

type FormState = { name: string; date: string; fullTime: string; partTime: string; active: boolean; note: string };
const blank: FormState = { name: "", date: "", fullTime: "2", partTime: "2", active: true, note: "" };

function toBps(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10000) : 0;
}
function fromBps(value: number | undefined) { return value ? String(value / 10000) : "1"; }

export default function StaffPublicHolidaysAdmin() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editingId, setEditingId] = useState("");
  const [openHistory, setOpenHistory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/system/staff-public-holidays", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Could not load public holidays."); return; }
    setHolidays(body.holidays || []);
  }, []);
  useEffect(()=>{ void load(); }, [load]);

  function editHoliday(holiday: Holiday) {
    const version = holiday.currentVersion || holiday.versions[0];
    if (!version) return;
    setEditingId(holiday.id);
    setForm({ name: version.name, date: europeanDateFromIso(holiday.holidayDate), fullTime: fromBps(version.full_time_multiplier_bps), partTime: fromBps(version.part_time_multiplier_bps), active: version.active, note: version.note || "" });
    setMessage(""); setError("");
  }

  async function save() {
    const fullTimeMultiplierBps = toBps(form.fullTime);
    const partTimeMultiplierBps = toBps(form.partTime);
    const holidayDate = parseEuropeanDate(form.date);
    if (!form.name.trim() || !holidayDate || !fullTimeMultiplierBps || !partTimeMultiplierBps) {
      setError("Name, a valid Date using DD/MM/YYYY, Full Time multiplier and Part Time multiplier are required."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(editingId ? `/api/system/staff-public-holidays/${encodeURIComponent(editingId)}` : "/api/system/staff-public-holidays", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? {
          name: form.name, fullTimeMultiplierBps, partTimeMultiplierBps, active: form.active, note: form.note,
        } : {
          name: form.name, holidayDate, fullTimeMultiplierBps, partTimeMultiplierBps, active: form.active, note: form.note,
        }),
      });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save public holiday.");
      setForm(blank); setEditingId(""); setMessage(editingId ? "New public-holiday version saved." : "Public holiday created."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save public holiday."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><CalendarDays className="h-6 w-6 text-orange-600"/><div><h2 className="text-xl font-black">Public Holidays</h2><p className="text-sm text-zinc-500">Separate Full Time and Part Time payroll multipliers with immutable Version history.</p></div></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      {message && <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Name"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="field" placeholder="e.g. Republic Day"/></Field>
        <Field label="Date"><input inputMode="numeric" placeholder="DD/MM/YYYY" value={form.date} disabled={Boolean(editingId)} onChange={e=>setForm({...form,date:e.target.value})} className="field disabled:bg-zinc-100"/></Field>
        <Field label="Full Time multiplier"><input inputMode="decimal" value={form.fullTime} onChange={e=>setForm({...form,fullTime:e.target.value})} className="field"/><small className="block text-zinc-400">e.g. 2.0x = {10000 * 2} BPS</small></Field>
        <Field label="Part Time multiplier"><input inputMode="decimal" value={form.partTime} onChange={e=>setForm({...form,partTime:e.target.value})} className="field"/></Field>
        <Field label="Note"><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="field"/></Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Plus className="h-4 w-4"/>{editingId ? "Save new version" : "Add public holiday"}</button>{editingId && <button onClick={()=>{setEditingId("");setForm(blank);}} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-black">Cancel edit</button>}<button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-black"><RefreshCw className="h-4 w-4"/>Refresh</button></div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>{["Date","Name","Full Time multiplier","Part Time multiplier","Active","Note",""].map(h=><th key={h} className="px-4 py-3 font-black">{h}</th>)}</tr></thead><tbody>{holidays.map(h=>{const v=h.currentVersion||h.versions[0];return <tr key={h.id} className="border-t border-zinc-100"><td className="px-4 py-3 font-bold">{formatEuropeanDate(h.holidayDate)}</td><td className="px-4 py-3 font-bold">{v?.name||"—"}</td><td className="px-4 py-3">{v ? `${v.full_time_multiplier_bps/10000}x` : "—"}</td><td className="px-4 py-3">{v ? `${v.part_time_multiplier_bps/10000}x` : "—"}</td><td className="px-4 py-3">{v?.active ? "Yes" : "No"}</td><td className="px-4 py-3">{v?.note||"—"}</td><td className="px-4 py-3"><div className="flex gap-3"><button onClick={()=>editHoliday(h)} className="font-black text-orange-700">Edit</button><button onClick={()=>setOpenHistory(openHistory===h.id?"":h.id)} className="font-black text-zinc-700">Version history</button></div>{openHistory===h.id && <div className="mt-3 min-w-[500px] space-y-2 rounded-xl bg-zinc-50 p-3">{h.versions.map(row=><div key={row.id} className="grid grid-cols-5 gap-2 text-xs"><strong>v{row.version_no}</strong><span>{row.name}</span><span>FT {row.full_time_multiplier_bps/10000}x</span><span>PT {row.part_time_multiplier_bps/10000}x</span><span>{row.superseded_at?"Superseded":row.active?"Current":"Inactive"}</span></div>)}</div>}</td></tr>})}{holidays.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No public holidays configured yet.</td></tr>}</tbody></table></div>
    </section>
    <style jsx>{`.field{margin-top:.25rem;width:100%;border:1px solid rgb(212 212 216);border-radius:.75rem;background:white;padding:.625rem .75rem;color:rgb(9 9 11)}`}</style>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="text-sm font-bold">{label}{children}</label>; }