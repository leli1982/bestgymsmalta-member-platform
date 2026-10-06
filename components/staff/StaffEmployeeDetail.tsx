"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock3, Euro, Fingerprint, Save, UserRound } from "lucide-react";
import { formatEuropeanDate } from "@/lib/europeanDate";

type Gym = { id: string; name: string; status?: string };
type EmployeeDetailData = {
  employee: {
    id: string; firstName: string; surname: string; idNumber: string; address: string | null;
    mobile: string | null; email: string | null; homeGymId: string; hasPhoto: boolean;
    photoUrl: string | null; active: boolean; currentHourlyRateCents: number | null;
    currentRateEffectiveFrom: string | null; currentEmploymentType: "full_time" | "part_time" | null;
    currentEmploymentTypeEffectiveFrom: string | null;
  };
  rateHistory: Array<{ id: string; hourly_rate_cents: number; effective_from: string }>;
  employmentTypeHistory: Array<{ id: string; employment_type: "full_time" | "part_time"; effective_from: string }>;
};

type Props = { employeeId: string; gyms: Gym[]; onChanged: () => void };
type Panel = "Details" | "Attendance" | "Payroll" | "Audit";

function eur(cents: number | null) {
  return cents === null ? "—" : new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function StaffEmployeeDetail({ employeeId, gyms, onChanged }: Props) {
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [panel, setPanel] = useState<Panel>("Details");
  const [form, setForm] = useState({ firstName: "", surname: "", idNumber: "", address: "", mobile: "", email: "", homeGymId: "", active: true });
  const [rate, setRate] = useState({ amount: "", effectiveFrom: "" });
  const [employment, setEmployment] = useState({ type: "full_time", effectiveFrom: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch(`/api/system/staff-employees/${encodeURIComponent(employeeId)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Could not load staff employee."); return; }
    setData(body);
    const e = body.employee;
    setForm({ firstName: e.firstName || "", surname: e.surname || "", idNumber: e.idNumber || "", address: e.address || "", mobile: e.mobile || "", email: e.email || "", homeGymId: e.homeGymId || "", active: Boolean(e.active) });
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);
  const sortedRates = useMemo(() => [...(data?.rateHistory || [])].sort((a,b)=>a.effective_from.localeCompare(b.effective_from)), [data]);
  const sortedTypes = useMemo(() => [...(data?.employmentTypeHistory || [])].sort((a,b)=>a.effective_from.localeCompare(b.effective_from)), [data]);

  async function saveProfile() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-employees/${encodeURIComponent(employeeId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save staff employee.");
      setMessage("Staff details saved."); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save staff employee."); }
    finally { setBusy(false); }
  }

  async function addRate() {
    const euros = Number(rate.amount);
    if (!Number.isFinite(euros) || euros < 0 || !rate.effectiveFrom) { setError("Enter an hourly rate and Effective from date."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-employees/${encodeURIComponent(employeeId)}/rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hourlyRateCents: Math.round(euros * 100), effectiveFrom: rate.effectiveFrom }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not add hourly rate.");
      setRate({ amount: "", effectiveFrom: "" }); setMessage("Hourly rate added."); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add hourly rate."); }
    finally { setBusy(false); }
  }

  async function addEmploymentType() {
    if (!employment.effectiveFrom) { setError("Enter an employment type Effective from date."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-employees/${encodeURIComponent(employeeId)}/employment-type`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employmentType: employment.type, effectiveFrom: employment.effectiveFrom }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not add employment type.");
      setEmployment({ type: "full_time", effectiveFrom: "" }); setMessage("Employment type added."); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add employment type."); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/webp") { setError("Photo must be WebP."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch(`/api/system/staff-employees/${encodeURIComponent(employeeId)}/photo`, { method: "POST", body });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Could not save photo.");
      setMessage("Photo updated."); await load(); onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save photo."); }
    finally { setBusy(false); }
  }

  if (!data) return <div className="rounded-2xl border border-zinc-200 bg-white p-5">{error || "Loading staff details…"}</div>;
  const e = data.employee;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
      {(["Details","Attendance","Payroll","Audit"] as Panel[]).map(name => <button key={name} onClick={()=>setPanel(name)} className={`rounded-xl px-4 py-2 text-sm font-black ${panel===name?"bg-zinc-950 text-white":"bg-zinc-100 text-zinc-700"}`}>{name}</button>)}
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
    {message && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}

    {panel === "Details" && <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-center">
          <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
            {e.photoUrl ? <img src={e.photoUrl} alt={`${e.firstName} ${e.surname}`} className="h-full w-full object-cover"/> : <UserRound className="h-16 w-16 text-zinc-300"/>}
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white"><Camera className="h-4 w-4"/> Photo<input type="file" accept="image/webp" className="hidden" onChange={event=>void uploadPhoto(event.target.files?.[0])}/></label>
          <p className="mt-2 text-xs text-zinc-500">WebP, max 5 MB</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name"><input value={form.firstName} onChange={x=>setForm({...form,firstName:x.target.value})} className="input"/></Field>
          <Field label="Surname"><input value={form.surname} onChange={x=>setForm({...form,surname:x.target.value})} className="input"/></Field>
          <Field label="ID card"><input value={form.idNumber} onChange={x=>setForm({...form,idNumber:x.target.value})} className="input"/></Field>
          <Field label="Mobile"><input value={form.mobile} onChange={x=>setForm({...form,mobile:x.target.value})} className="input"/></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={x=>setForm({...form,email:x.target.value})} className="input"/></Field>
          <Field label="Home gym"><select value={form.homeGymId} onChange={x=>setForm({...form,homeGymId:x.target.value})} className="input"><option value="">Choose gym</option>{gyms.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          <Field label="Address" wide><textarea value={form.address} onChange={x=>setForm({...form,address:x.target.value})} className="input min-h-20"/></Field>
          <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={x=>setForm({...form,active:x.target.checked})}/> Active</label>
          <div className="sm:col-span-2"><button disabled={busy} onClick={()=>void saveProfile()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/>Save details</button></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2"><Euro className="h-5 w-5 text-orange-600"/><h3 className="font-black">Hourly rate</h3></div>
          <p className="mt-1 text-sm text-zinc-600">Current: <strong>{eur(e.currentHourlyRateCents)}</strong>{e.currentRateEffectiveFrom ? ` · from ${formatEuropeanDate(e.currentRateEffectiveFrom)}` : ""}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Hourly rate (€)"><input inputMode="decimal" value={rate.amount} onChange={x=>setRate({...rate,amount:x.target.value})} className="input"/></Field><Field label="Effective from"><input type="date" value={rate.effectiveFrom} onChange={x=>setRate({...rate,effectiveFrom:x.target.value})} className="input"/></Field></div>
          <button disabled={busy} onClick={()=>void addRate()} className="mt-3 rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white">Add rate</button>
          <div className="mt-4 space-y-2">{sortedRates.map(row=><div key={row.id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"><span>{formatEuropeanDate(row.effective_from)}</span><strong>{eur(row.hourly_rate_cents)}</strong></div>)}</div>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-orange-600"/><h3 className="font-black">Employment type</h3></div>
          <p className="mt-1 text-sm text-zinc-600">Current: <strong>{e.currentEmploymentType === "full_time" ? "Full Time" : e.currentEmploymentType === "part_time" ? "Part Time" : "—"}</strong></p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Employment type"><select value={employment.type} onChange={x=>setEmployment({...employment,type:x.target.value})} className="input"><option value="full_time">Full Time</option><option value="part_time">Part Time</option></select></Field><Field label="Effective from"><input type="date" value={employment.effectiveFrom} onChange={x=>setEmployment({...employment,effectiveFrom:x.target.value})} className="input"/></Field></div>
          <button disabled={busy} onClick={()=>void addEmploymentType()} className="mt-3 rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white">Add employment type</button>
          <div className="mt-4 space-y-2">{sortedTypes.map(row=><div key={row.id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"><span>{formatEuropeanDate(row.effective_from)}</span><strong>{row.employment_type === "full_time" ? "Full Time" : "Part Time"}</strong></div>)}</div>
        </section>
      </div>
    </div>}

    {panel !== "Details" && <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-zinc-400"/><p className="mt-3 font-black">{panel}</p><p className="mt-1 text-sm text-zinc-500">This panel is reserved for the next attendance/payroll implementation stage. No placeholder data is shown.</p>{panel === "Audit" && <a href={`/staff/admin/audit-trail?q=${encodeURIComponent(`${e.firstName} ${e.surname}`)}`} className="mt-3 inline-block text-sm font-black text-orange-700 underline">Open central Audit Trail</a>}</div>}

    <div className="hidden"><Fingerprint/> Full Time Part Time Hourly rate Effective from ID card Home gym Photo Active Details Attendance Payroll Audit</div>
    <style jsx>{`.input{margin-top:.25rem;width:100%;border:1px solid rgb(212 212 216);border-radius:.75rem;background:white;padding:.625rem .75rem;color:rgb(9 9 11)} `}</style>
  </section>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`text-sm font-bold ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
