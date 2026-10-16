"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Download, Mail, Printer, RefreshCw, Wrench } from "lucide-react";
import { addDaysToDateKey, todayMaltaDate } from "@/lib/maltaDate";
import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import type { StaffTimesheetEmployeeReport } from "@/lib/staffTimesheetReport";

type Adjustment = { id: string; employeeId: string; sessionId: string | null; action: string; actionTime: string; effectiveAt: string | null; reason: string | null; performedBy: string | null; beforeState: unknown; afterState: unknown };
type ResponseData = { ok: boolean; reports: StaffTimesheetEmployeeReport[]; adjustments: Adjustment[]; gyms: Array<{id:string;name:string}>; summary: { employeeCount:number; workedMinutes:number; normalPayCents:number; holidayPayCents:number; payCents:number; needsAttention:number }; error?: string };
type Props = { employeeId?: string; embedded?: boolean; focus?: "attendance" | "payroll" };

type Filters = { fromDate:string; toDate:string; employeeId:string; homeGymId:string; workedGymId:string; status:string };

function mondayOf(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sinceMonday);
  return date.toISOString().slice(0, 10);
}
function duration(minutes: number | null) { return minutes === null ? "—" : `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}m`; }
function money(cents: number | null) { return cents === null ? "—" : new Intl.NumberFormat("en-MT", { style:"currency", currency:"EUR" }).format(cents/100); }
function asQuery(filters: Filters, includeSalary: boolean) {
  const params = new URLSearchParams({ fromDate: filters.fromDate, toDate: filters.toDate, includeSalary: String(includeSalary) });
  for (const key of ["employeeId","homeGymId","workedGymId","status"] as const) if (filters[key]) params.set(key, filters[key]);
  return params;
}

export default function StaffTimesheetsAdmin({ employeeId = "", embedded = false, focus = "payroll" }: Props) {
  const today = useMemo(() => todayMaltaDate(), []);
  const [filters, setFilters] = useState<Filters>({ fromDate: mondayOf(today), toDate: today, employeeId, homeGymId:"", workedGymId:"", status:"" });
  const [data, setData] = useState<ResponseData | null>(null);
  const [staffOptions, setStaffOptions] = useState<Array<{id:string;name:string}>>([]);
  const [includeSalary, setIncludeSalary] = useState(focus === "payroll");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { if (employeeId) setFilters((current)=>({ ...current, employeeId })); }, [employeeId]);
  useEffect(() => { if (focus === "attendance") setIncludeSalary(false); }, [focus]);

  const loadStaffOptions = useCallback(async () => {
    if (employeeId) return;
    try {
      const response = await fetch("/api/system/staff-employees", { cache:"no-store" });
      const body = await response.json();
      if (response.ok) setStaffOptions((body.employees || []).map((row:any)=>({id:String(row.id),name:`${row.firstName || ""} ${row.surname || ""}`.trim()})));
    } catch { /* primary timesheet error remains authoritative */ }
  }, [employeeId]);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/system/staff-attendance/timesheets?${asQuery(filters, includeSalary).toString()}`, { cache:"no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load staff timesheets.");
      setData(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load staff timesheets."); }
    finally { setBusy(false); }
  }, [filters, includeSalary]);

  useEffect(()=>{ void loadStaffOptions(); },[loadStaffOptions]);
  useEffect(()=>{ void load(); },[load]);

  function setPreset(kind:"week"|"month") {
    if (kind === "week") setFilters((current)=>({ ...current, fromDate:mondayOf(today), toDate:today }));
    else setFilters((current)=>({ ...current, fromDate:`${today.slice(0,7)}-01`, toDate:today }));
  }

  const selectedReport = data?.reports.find((report)=>report.employee.id===filters.employeeId) || (employeeId ? data?.reports[0] : undefined);

  async function manualPunch() {
    const targetEmployee = employeeId || filters.employeeId;
    if (!targetEmployee) { setError("Choose a staff employee before using Manual Punch."); return; }
    const gymId = window.prompt("Manual Punch — enter the gym ID shown in the Worked gym filter list:", data?.gyms[0]?.id || "")?.trim();
    if (!gymId) return;
    const punchAt = window.prompt("Punch time in ISO format (for example 2026-10-16T14:30:00+02:00):", new Date().toISOString())?.trim();
    if (!punchAt) return;
    const reason = window.prompt("Reason for this Super Admin Manual Punch:")?.trim();
    if (!reason) { setError("A reason is mandatory for every Manual Punch."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-attendance/manual-punch", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ employeeId:targetEmployee, gymId, punchAt, reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Manual punch failed.");
      setMessage(`Manual Punch recorded: ${String(body.outcome || "completed").replaceAll("_"," ")}.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Manual punch failed."); }
    finally { setBusy(false); }
  }

  async function correctSession(session: StaffTimesheetEmployeeReport["sessions"][number]) {
    const clockInAt = window.prompt("Correct IN time (ISO). Leave unchanged to keep the current value:", session.clockInAt)?.trim();
    if (clockInAt === undefined) return;
    const clockOutAt = window.prompt("Correct OUT time (ISO). Leave blank for an open session:", session.clockOutAt || "")?.trim();
    if (clockOutAt === undefined) return;
    const reason = window.prompt("Reason for this Correct Session action:")?.trim();
    if (!reason) { setError("A reason is mandatory for every attendance correction."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-attendance/sessions/${encodeURIComponent(session.id)}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ clockInAt:clockInAt || session.clockInAt, clockOutAt:clockOutAt || null, reason, reviewMidnight:Boolean(session.attentionCode) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not correct the attendance session.");
      setMessage("Attendance session corrected and audit trail updated."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not correct the attendance session."); }
    finally { setBusy(false); }
  }

  function printReport() {
    window.open(`/staff/admin/staff/timesheets/print?${asQuery(filters, includeSalary).toString()}`, "_blank", "noopener,noreferrer");
  }
  function exportExcel() { window.location.href = `/api/system/staff-attendance/timesheets/export?${asQuery(filters, includeSalary).toString()}`; }
  async function emailReports(selectedOnly:boolean) {
    const selectedId = employeeId || filters.employeeId;
    if (selectedOnly && !selectedId) { setError("Choose a staff employee before using Email selected."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-attendance/timesheets/email", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...filters, employeeId: selectedOnly ? selectedId : filters.employeeId || undefined, employeeIds:selectedOnly && selectedId ? [selectedId] : undefined, includeSalary }) });
      const body = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(body.error || "Could not email staff timesheets.");
      setMessage(`Email result: ${(body.sent||[]).length} sent, ${(body.skipped||[]).length} skipped (including missing email), ${(body.failed||[]).length} failed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not email staff timesheets."); }
    finally { setBusy(false); }
  }

  const reports = data?.reports || [];
  const adjustments = data?.adjustments || [];
  const showSalary = includeSalary && focus !== "attendance";

  return <section className={embedded ? "space-y-4" : "rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-5"}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Attendance & payroll</p><h2 className="text-2xl font-black">Timesheets</h2><p className="mt-1 text-sm text-zinc-500">Persisted attendance segments, exact minutes and historical rates.</p></div><button onClick={()=>void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><RefreshCw className={`h-4 w-4 ${busy?"animate-spin":""}`}/>Refresh</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
    {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="text-sm font-bold">From<input type="date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.fromDate} onChange={e=>setFilters({...filters,fromDate:e.target.value})}/></label>
      <label className="text-sm font-bold">To<input type="date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.toDate} onChange={e=>setFilters({...filters,toDate:e.target.value})}/></label>
      {!employeeId && <label className="text-sm font-bold">Staff<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}><option value="">All staff</option>{staffOptions.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <label className="text-sm font-bold">Home gym<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.homeGymId} onChange={e=>setFilters({...filters,homeGymId:e.target.value})}><option value="">All gyms</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="text-sm font-bold">Worked gym<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.workedGymId} onChange={e=>setFilters({...filters,workedGymId:e.target.value})}><option value="">All gyms</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="text-sm font-bold">Status<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="corrected">Corrected</option><option value="needs_attention">Needs Attention</option></select></label>
    </div>
    <div className="flex flex-wrap gap-2"><button onClick={()=>setPreset("week")} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">This week</button><button onClick={()=>setPreset("month")} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">This month</button><span className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">Custom</span>{focus!=="attendance" && <label className="ml-auto flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black"><input type="checkbox" checked={includeSalary} onChange={e=>setIncludeSalary(e.target.checked)}/> Include salary</label>}</div>

    <div className="flex flex-wrap gap-2"><button onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-black text-white"><Printer className="h-4 w-4"/>Print / Save PDF</button><button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Download className="h-4 w-4"/>Export Excel</button><button onClick={()=>void emailReports(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Mail className="h-4 w-4"/>Email selected</button><button onClick={()=>void emailReports(false)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Mail className="h-4 w-4"/>Email all filtered</button><button onClick={()=>void manualPunch()} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white"><Clock3 className="h-4 w-4"/>Manual Punch</button></div>

    {data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Staff" value={String(data.summary.employeeCount)}/><Stat label="Selected Period" value={duration(data.summary.workedMinutes)}/><Stat label="Needs Attention" value={String(data.summary.needsAttention)}/>{showSalary && <Stat label="Normal pay" value={money(data.summary.normalPayCents)}/>} {showSalary && <Stat label="Public holiday pay" value={money(data.summary.holidayPayCents)}/>} {showSalary && <Stat label="Total calculated pay" value={money(data.summary.payCents)}/>}</div>}

    <div className="space-y-5">{reports.map(report=><article key={report.employee.id} className="overflow-hidden rounded-2xl border border-zinc-200"><div className="flex flex-wrap justify-between gap-2 bg-zinc-50 px-4 py-3"><div><h3 className="font-black">{report.employee.name}</h3><p className="text-xs text-zinc-500">Home gym: {report.employee.homeGymName||"—"}{!report.employee.email && " · missing email"}</p></div><div className="text-right text-sm"><strong>{duration(report.selectedPeriod.workedMinutes)}</strong>{showSalary && <span className="ml-3 font-black text-orange-700">{money(report.selectedPeriod.payCents)}</span>}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-white text-xs uppercase text-zinc-500"><tr>{["Date","IN","IN gym","OUT","OUT gym","Status","Daily total",...(showSalary?["Normal pay","Public holiday pay","Total calculated pay"]:[]),""].map(h=><th key={h} className="px-3 py-2 font-black">{h}</th>)}</tr></thead><tbody>{report.days.flatMap(day=>day.allocations.map((allocation,index)=><tr key={allocation.id} className="border-t border-zinc-100"><td className="px-3 py-2">{formatEuropeanDate(day.date)}</td><td className="px-3 py-2">{formatEuropeanDateTime(allocation.clockInAt)}</td><td className="px-3 py-2">{allocation.clockInGymName||"—"}</td><td className="px-3 py-2">{allocation.clockOutAt?formatEuropeanDateTime(allocation.clockOutAt):"OPEN"}</td><td className="px-3 py-2">{allocation.clockOutGymName||"—"}</td><td className="px-3 py-2"><span className={allocation.attentionCode?"font-black text-red-700":"font-bold"}>{allocation.attentionCode||allocation.status}</span></td><td className="px-3 py-2 font-bold">{index===0?duration(day.workedMinutes):""}</td>{showSalary && <><td className="px-3 py-2">{index===0?money(day.normalPayCents):""}</td><td className="px-3 py-2">{index===0?money(day.holidayPayCents):""}</td><td className="px-3 py-2 font-black">{index===0?money(day.payCents):""}</td></>}<td className="px-3 py-2"><button onClick={()=>{const session=report.sessions.find(row=>row.id===allocation.sessionId);if(session)void correctSession(session);}} className="inline-flex items-center gap-1 font-black text-orange-700"><Wrench className="h-3.5 w-3.5"/>Correct Session</button></td></tr>)))}</tbody></table></div><div className="grid gap-3 border-t border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3"><div><p className="text-xs font-black uppercase text-zinc-500">Daily total</p><p className="text-sm">Shown per day above</p></div><div><p className="text-xs font-black uppercase text-zinc-500">Weekly</p><p className="text-sm">{report.weeklyTotals.map(row=>`${formatEuropeanDate(row.key)}: ${duration(row.workedMinutes)}`).join(" · ")||"—"}</p></div><div><p className="text-xs font-black uppercase text-zinc-500">Monthly</p><p className="text-sm">{report.monthlyTotals.map(row=>`${row.key}: ${duration(row.workedMinutes)}`).join(" · ")||"—"}</p></div></div></article>)}{!busy && reports.length===0 && <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">No attendance records match these filters.</p>}</div>

    {embedded && adjustments.length>0 && <section className="rounded-2xl border border-zinc-200 p-4"><h3 className="font-black">Attendance adjustments</h3><div className="mt-3 space-y-2">{adjustments.map(row=><div key={row.id} className="rounded-xl bg-zinc-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{row.action.replaceAll("_"," ")}</strong><span>{formatEuropeanDateTime(row.actionTime)}</span></div><p className="mt-1 text-zinc-600">Reason: {row.reason||"—"}</p></div>)}</div></section>}
    <span className="hidden">IN OUT reason staff-attendance/timesheets manual-punch sessions/</span>
  </section>;
}

function Stat({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
