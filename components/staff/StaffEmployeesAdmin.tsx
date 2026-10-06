"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Fingerprint, Plus, Search, UserRound, UsersRound } from "lucide-react";
import StaffEmployeeDetail from "@/components/staff/StaffEmployeeDetail";
import StaffPublicHolidaysAdmin from "@/components/staff/StaffPublicHolidaysAdmin";
import { parseEuropeanDate } from "@/lib/europeanDate";

type Gym = { id: string; name: string; status?: string };
type Employee = {
  id: string; firstName: string; surname: string; idNumber: string; address: string | null;
  mobile: string | null; email: string | null; homeGymId: string; hasPhoto: boolean; active: boolean;
  currentHourlyRateCents: number | null; currentRateEffectiveFrom: string | null;
  currentEmploymentType: "full_time" | "part_time" | null;
  currentEmploymentTypeEffectiveFrom: string | null;
  fingerprintStatus?: "enrolled" | "pending" | "revoked" | "not_enrolled";
};
type ResponseData = { employees: Employee[]; gyms: Gym[]; asOfDate: string };
type Area = "Employees" | "Timesheets" | "Public Holidays" | "Punch Clock Terminals";

const blankCreate = {
  firstName: "", surname: "", idNumber: "", address: "", mobile: "", email: "", homeGymId: "",
  initialHourlyRate: "", rateEffectiveFrom: "", initialEmploymentType: "full_time", employmentTypeEffectiveFrom: "",
};

function eur(cents: number | null) {
  return cents === null ? "—" : new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function StaffEmployeesAdmin() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [data, setData] = useState<ResponseData | null>(null);
  const [area, setArea] = useState<Area>("Employees");
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState(blankCreate);
  const [filters, setFilters] = useState({ q: "", gym: "", active: "", employment: "", fingerprint: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        const body = await response.json();
        if (mounted) setIsSuperAdmin(Boolean(response.ok && body.authenticated && body.user?.isSuperAdmin));
      } catch { if (mounted) setIsSuperAdmin(false); }
      finally { if (mounted) setAuthChecked(true); }
    })();
    return ()=>{mounted=false;};
  },[]);

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    setError("");
    try {
      const response = await fetch("/api/system/staff-employees", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load staff employees.");
      setData(body);
      if (selectedId && !(body.employees || []).some((employee: Employee)=>employee.id===selectedId)) setSelectedId("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load staff employees."); }
  }, [isSuperAdmin, selectedId]);

  useEffect(()=>{ void load(); },[load]);

  const gymName = useMemo(() => new Map((data?.gyms||[]).map(g=>[g.id,g.name])), [data]);
  const filtered = useMemo(() => (data?.employees || []).filter(employee => {
    const q = filters.q.trim().toLowerCase();
    if (q && !`${employee.firstName} ${employee.surname} ${employee.idNumber} ${employee.email||""} ${employee.mobile||""}`.toLowerCase().includes(q)) return false;
    if (filters.gym && employee.homeGymId !== filters.gym) return false;
    if (filters.active && String(employee.active) !== filters.active) return false;
    if (filters.employment && employee.currentEmploymentType !== filters.employment) return false;
    if (filters.fingerprint && (employee.fingerprintStatus || "not_enrolled") !== filters.fingerprint) return false;
    return true;
  }), [data, filters]);

  async function createEmployee() {
    const euros = Number(create.initialHourlyRate);
    const rateEffectiveFrom = parseEuropeanDate(create.rateEffectiveFrom);
    const employmentTypeEffectiveFrom = parseEuropeanDate(create.employmentTypeEffectiveFrom);
    if (!create.firstName.trim() || !create.surname.trim() || !create.idNumber.trim() || !create.homeGymId || !Number.isFinite(euros) || euros < 0 || !rateEffectiveFrom || !employmentTypeEffectiveFrom) {
      setError("Complete the employee identity, Home gym, Hourly rate and both Effective from dates using DD/MM/YYYY."); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-employees", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({
        firstName:create.firstName, surname:create.surname, idNumber:create.idNumber, address:create.address, mobile:create.mobile, email:create.email,
        homeGymId:create.homeGymId, initialHourlyRateCents:Math.round(euros*100), rateEffectiveFrom,
        initialEmploymentType:create.initialEmploymentType, employmentTypeEffectiveFrom,
      }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not create staff employee.");
      setCreate(blankCreate); setShowCreate(false); setMessage("Staff employee created."); await load(); setSelectedId(body.employee.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create staff employee."); }
    finally { setBusy(false); }
  }

  if (!authChecked) return <main className="min-h-screen bg-[#f6f6f6] p-8 text-zinc-700">Checking Super Admin access…</main>;
  if (!isSuperAdmin) return <main className="min-h-screen bg-[#f6f6f6] p-8 text-zinc-900"><p className="font-black">Super Admin access required.</p><a href="/staff" className="mt-3 inline-block text-orange-700 underline">Staff Home</a></main>;

  return <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4"/> Super Admin</a>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Management</p><h1 className="mt-1 text-3xl font-black">Staff</h1><p className="mt-2 text-sm text-zinc-600">Employment records, pay configuration, attendance and payroll. Staff Portal logins remain separate.</p></div><UsersRound className="h-12 w-12 text-orange-600"/></div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm" aria-label="Staff management areas">
        {(["Employees","Timesheets","Public Holidays","Punch Clock Terminals"] as Area[]).map(name=><button key={name} onClick={()=>{setArea(name);setSelectedId("");}} className={`rounded-xl px-4 py-2.5 text-sm font-black ${area===name?"bg-zinc-950 text-white":"text-zinc-600 hover:bg-zinc-100"}`}>{name}</button>)}
      </nav>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}
      {message && <p className="rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">{message}</p>}

      {area === "Public Holidays" && <StaffPublicHolidaysAdmin/>}
      {area === "Timesheets" && <Coming title="Timesheets" text="The employee records are ready. Attendance totals and payroll reports are connected in the next implementation plan." icon={<Clock3 className="h-10 w-10"/>}/>} 
      {area === "Punch Clock Terminals" && <Coming title="Punch Clock Terminals" text="Terminal registration and the online punch state machine are connected in the next implementation plan." icon={<Fingerprint className="h-10 w-10"/>}/>} 

      {area === "Employees" && <>
        {!selectedId && <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Employees</h2><p className="text-sm text-zinc-500">{filtered.length} of {data?.employees.length || 0} staff records</p></div><button onClick={()=>setShowCreate(!showCreate)} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4"/>Add staff</button></div>

          {showCreate && <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/40 p-4"><h3 className="font-black">New staff employee</h3><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="First name"><input className="field" value={create.firstName} onChange={e=>setCreate({...create,firstName:e.target.value})}/></Field>
            <Field label="Surname"><input className="field" value={create.surname} onChange={e=>setCreate({...create,surname:e.target.value})}/></Field>
            <Field label="ID card"><input className="field" value={create.idNumber} onChange={e=>setCreate({...create,idNumber:e.target.value})}/></Field>
            <Field label="Home gym"><select className="field" value={create.homeGymId} onChange={e=>setCreate({...create,homeGymId:e.target.value})}><option value="">Choose gym</option>{(data?.gyms||[]).map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></Field>
            <Field label="Address"><input className="field" value={create.address} onChange={e=>setCreate({...create,address:e.target.value})}/></Field>
            <Field label="Mobile"><input className="field" value={create.mobile} onChange={e=>setCreate({...create,mobile:e.target.value})}/></Field>
            <Field label="Email"><input type="email" className="field" value={create.email} onChange={e=>setCreate({...create,email:e.target.value})}/></Field>
            <Field label="Hourly rate (€)"><input inputMode="decimal" className="field" value={create.initialHourlyRate} onChange={e=>setCreate({...create,initialHourlyRate:e.target.value})}/></Field>
            <Field label="Rate Effective from"><input inputMode="numeric" placeholder="DD/MM/YYYY" className="field" value={create.rateEffectiveFrom} onChange={e=>setCreate({...create,rateEffectiveFrom:e.target.value})}/></Field>
            <Field label="Employment type"><select className="field" value={create.initialEmploymentType} onChange={e=>setCreate({...create,initialEmploymentType:e.target.value})}><option value="full_time">Full Time</option><option value="part_time">Part Time</option></select></Field>
            <Field label="Employment Effective from"><input inputMode="numeric" placeholder="DD/MM/YYYY" className="field" value={create.employmentTypeEffectiveFrom} onChange={e=>setCreate({...create,employmentTypeEffectiveFrom:e.target.value})}/></Field>
          </div><div className="mt-4 flex gap-2"><button disabled={busy} onClick={()=>void createEmployee()} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Create employee</button><button onClick={()=>setShowCreate(false)} className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-black">Cancel</button></div></div>}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Search"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400"/><input value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})} className="field pl-9" placeholder="Name, ID, email…"/></div></Field>
            <Field label="Home gym"><select value={filters.gym} onChange={e=>setFilters({...filters,gym:e.target.value})} className="field"><option value="">All gyms</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
            <Field label="Active"><select value={filters.active} onChange={e=>setFilters({...filters,active:e.target.value})} className="field"><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></Field>
            <Field label="Employment type"><select value={filters.employment} onChange={e=>setFilters({...filters,employment:e.target.value})} className="field"><option value="">All</option><option value="full_time">Full Time</option><option value="part_time">Part Time</option></select></Field>
            <Field label="Fingerprint"><select value={filters.fingerprint} onChange={e=>setFilters({...filters,fingerprint:e.target.value})} className="field"><option value="">All</option><option value="enrolled">Enrolled</option><option value="pending">Pending</option><option value="revoked">Revoked</option><option value="not_enrolled">Not enrolled</option></select></Field>
          </div>

          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>{["Staff","ID card","Home gym","Employment type","Hourly rate","Fingerprint","Status",""].map(h=><th key={h} className="px-4 py-3 font-black">{h}</th>)}</tr></thead><tbody>{filtered.map(employee=><tr key={employee.id} className="border-t border-zinc-100"><td className="px-4 py-3"><strong>{employee.firstName} {employee.surname}</strong><span className="block text-xs text-zinc-500">{employee.email||employee.mobile||"—"}</span></td><td className="px-4 py-3 font-mono">{employee.idNumber}</td><td className="px-4 py-3">{gymName.get(employee.homeGymId)||employee.homeGymId}</td><td className="px-4 py-3">{employee.currentEmploymentType==="full_time"?"Full Time":employee.currentEmploymentType==="part_time"?"Part Time":"—"}</td><td className="px-4 py-3 font-bold">{eur(employee.currentHourlyRateCents)}</td><td className="px-4 py-3">{(employee.fingerprintStatus||"not_enrolled").replace("_"," ")}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${employee.active?"bg-green-100 text-green-800":"bg-zinc-200 text-zinc-600"}`}>{employee.active?"Active":"Inactive"}</span></td><td className="px-4 py-3"><button onClick={()=>setSelectedId(employee.id)} className="font-black text-orange-700">Open</button></td></tr>)}{filtered.length===0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No staff match these filters.</td></tr>}</tbody></table></div>
        </section>}

        {selectedId && <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><button onClick={()=>setSelectedId("")} className="mb-4 text-sm font-black text-orange-700">← Employees</button><StaffEmployeeDetail employeeId={selectedId} gyms={data?.gyms||[]} onChanged={()=>void load()}/></section>}
      </>}
      <style jsx>{`.field{margin-top:.25rem;width:100%;border:1px solid rgb(212 212 216);border-radius:.75rem;background:white;padding:.625rem .75rem;color:rgb(9 9 11)}`}</style>
    </div>
  </main>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="text-sm font-bold">{label}{children}</label>; }
function Coming({title,text,icon}:{title:string;text:string;icon:React.ReactNode}) { return <section className="rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto w-fit text-orange-600">{icon}</div><h2 className="mt-3 text-2xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">{text}</p></section>; }