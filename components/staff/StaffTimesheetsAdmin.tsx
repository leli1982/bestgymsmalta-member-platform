"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Download, Mail, Printer, RefreshCw, Wrench, X } from "lucide-react";
import EuropeanDateInput from "@/components/ui/EuropeanDateInput";
import { todayMaltaDate } from "@/lib/maltaDate";
import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import type { StaffTimesheetEmployeeReport } from "@/lib/staffTimesheetReport";

type Adjustment = { id: string; employeeId: string; sessionId: string | null; action: string; actionTime: string; effectiveAt: string | null; reason: string | null; performedBy: string | null; beforeState: unknown; afterState: unknown };
type StaffOption = { id: string; name: string };
type ResponseData = { ok: boolean; reports: StaffTimesheetEmployeeReport[]; adjustments: Adjustment[]; gyms: Array<{id:string;name:string}>; summary: { employeeCount:number; workedMinutes:number; normalPayCents:number; holidayPayCents:number; payCents:number; needsAttention:number }; error?: string };
type Props = { employeeId?: string; embedded?: boolean; focus?: "attendance" | "payroll" };
type Filters = { fromDate:string; toDate:string; employeeId:string; homeGymId:string; workedGymId:string; status:string };
type ManualPunchDraft = { employeeId:string; gymId:string; date:string; time:string; reason:string };
type CorrectionDraft = { session:StaffTimesheetEmployeeReport["sessions"][number]; inDate:string; inTime:string; outDate:string; outTime:string; reason:string };

function mondayOf(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sinceMonday);
  return date.toISOString().slice(0, 10);
}
function duration(minutes: number | null) { return minutes === null ? "—" : `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}m`; }
function money(cents: number | null) { return cents === null ? "—" : new Intl.NumberFormat("en-MT", { style:"currency", currency:"EUR" }).format(cents/100); }
function employmentLabel(value: string | null) { return value === "part_time" ? "Part Time" : value === "full_time" ? "Full Time" : "Employment type unavailable"; }
function multiplierLabel(value: number | null) { return value === null ? "Multiplier unavailable" : `${(value/10000).toFixed(2)}x`; }
function asQuery(filters: Filters, includeSalary: boolean) {
  const params = new URLSearchParams({ fromDate: filters.fromDate, toDate: filters.toDate, includeSalary: String(includeSalary) });
  for (const key of ["employeeId","homeGymId","workedGymId","status"] as const) if (filters[key]) params.set(key, filters[key]);
  return params;
}
function maltaDateTimeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Malta", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date(value));
  const read = (type:string) => parts.find(part=>part.type===type)?.value || "";
  return { date:`${read("year")}-${read("month")}-${read("day")}`, time:`${read("hour")}:${read("minute")}` };
}
function currentMaltaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/Malta", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date());
  const read = (type:string) => parts.find(part=>part.type===type)?.value || "00";
  return `${read("hour")}:${read("minute")}`;
}
function localDateTimeToIso(date:string, time:string) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

export default function StaffTimesheetsAdmin({ employeeId = "", embedded = false, focus = "payroll" }: Props) {
  const today = useMemo(() => todayMaltaDate(), []);
  const [filters, setFilters] = useState<Filters>({ fromDate:`${today.slice(0,7)}-01`, toDate:today, employeeId, homeGymId:"", workedGymId:"", status:"" });
  const [data, setData] = useState<ResponseData | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [includeSalary, setIncludeSalary] = useState(focus === "payroll");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manualPunchDraft, setManualPunchDraft] = useState<ManualPunchDraft | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft | null>(null);

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

  const reports = data?.reports || [];
  const adjustments = data?.adjustments || [];
  const showSalary = includeSalary && focus !== "attendance";
  const staffSearchTerm = staffSearch.trim().toLowerCase();
  const filteredStaffOptions = staffOptions.filter((row: StaffOption) => !staffSearchTerm || row.name.toLowerCase().includes(staffSearchTerm) || row.id.toLowerCase().includes(staffSearchTerm));

  function openManualPunch() {
    const targetEmployee = employeeId || filters.employeeId;
    if (!targetEmployee) { setError("Choose a staff employee before using Manual Punch."); return; }
    setError("");
    setManualPunchDraft({ employeeId:targetEmployee, gymId:filters.workedGymId || data?.gyms[0]?.id || "", date:today, time:currentMaltaTime(), reason:"" });
  }

  async function submitManualPunch() {
    if (!manualPunchDraft) return;
    const { employeeId:targetEmployee, gymId, date, time, reason } = manualPunchDraft;
    if (!gymId) { setError("Choose a gym for the Manual Punch."); return; }
    if (!date || !time) { setError("Punch date and Punch time are required."); return; }
    if (!reason.trim()) { setError("A reason is mandatory for every Manual Punch."); return; }
    const punchAt = localDateTimeToIso(date, time);
    if (!punchAt) { setError("Enter a valid Punch date and Punch time."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-attendance/manual-punch", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ employeeId:targetEmployee, gymId, punchAt, reason:reason.trim() }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Manual punch failed.");
      setManualPunchDraft(null);
      setMessage(`Manual Punch recorded: ${String(body.outcome || "completed").replaceAll("_"," ")}.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Manual punch failed."); }
    finally { setBusy(false); }
  }

  function openCorrection(session: StaffTimesheetEmployeeReport["sessions"][number]) {
    const inParts = maltaDateTimeParts(session.clockInAt);
    const outParts = session.clockOutAt ? maltaDateTimeParts(session.clockOutAt) : { date:"", time:"" };
    setError("");
    setCorrectionDraft({ session, inDate:inParts.date, inTime:inParts.time, outDate:outParts.date, outTime:outParts.time, reason:"" });
  }

  async function submitCorrection() {
    if (!correctionDraft) return;
    const { session, inDate, inTime, outDate, outTime, reason } = correctionDraft;
    if (!inDate || !inTime) { setError("Correct IN date and Correct IN time are required."); return; }
    if ((outDate && !outTime) || (!outDate && outTime)) { setError("Enter both Correct OUT date and Correct OUT time, or leave both blank for an open session."); return; }
    if (!reason.trim()) { setError("A reason is mandatory for every attendance correction."); return; }
    const clockInAt = localDateTimeToIso(inDate, inTime);
    const clockOutAt = outDate && outTime ? localDateTimeToIso(outDate, outTime) : null;
    if (!clockInAt || (outDate && outTime && !clockOutAt)) { setError("Enter valid correction dates and times."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/staff-attendance/sessions/${encodeURIComponent(session.id)}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ clockInAt, clockOutAt, reason:reason.trim(), reviewMidnight:Boolean(session.attentionCode) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not correct the attendance session.");
      setCorrectionDraft(null);
      setMessage("Attendance session corrected and audit trail updated."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not correct the attendance session."); }
    finally { setBusy(false); }
  }

  function printReport() { window.open(`/staff/admin/staff/timesheets/print?${asQuery(filters, includeSalary).toString()}`, "_blank", "noopener,noreferrer"); }
  function exportExcel() { window.location.href = `/api/system/staff-attendance/timesheets/export?${asQuery(filters, includeSalary).toString()}`; }
  async function emailReports(selectedOnly:boolean) {
    const selectedId = employeeId || filters.employeeId;
    if (selectedOnly && !selectedId) { setError("Choose a staff employee before using Email selected."); return; }
    if (!selectedOnly) {
      const missingEmailCount = reports.filter((report)=>!report.employee.email).length;
      const confirmed = window.confirm(`Send ${reports.length} individual email${reports.length===1?"":"s"}? ${missingEmailCount} staff member${missingEmailCount===1?"":"s"} ${missingEmailCount===1?"is":"are"} missing email and will be skipped.`);
      if (!confirmed) return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/staff-attendance/timesheets/email", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...filters, employeeId: selectedOnly ? selectedId : filters.employeeId || undefined, employeeIds:selectedOnly&&selectedId ? [selectedId] : undefined, includeSalary }) });
      const body = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(body.error || "Could not email staff timesheets.");
      setMessage(`Email result: ${(body.sent||[]).length} sent, ${(body.skipped||[]).length} skipped (including missing email), ${(body.failed||[]).length} failed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not email staff timesheets."); }
    finally { setBusy(false); }
  }

  return <section className={embedded ? "space-y-4" : "rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-5"}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Attendance & payroll</p><h2 className="text-2xl font-black">Timesheets</h2><p className="mt-1 text-sm text-zinc-500">Persisted attendance segments, exact minutes and historical rates.</p></div><button onClick={()=>void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><RefreshCw className={`h-4 w-4 ${busy?"animate-spin":""}`}/>Refresh</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
    {message && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="text-sm font-bold">From<EuropeanDateInput ariaLabel="From date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.fromDate} max={filters.toDate || undefined} onValueChange={fromDate=>setFilters({...filters,fromDate})}/></label>
      <label className="text-sm font-bold">To<EuropeanDateInput ariaLabel="To date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.toDate} min={filters.fromDate || undefined} max={today} onValueChange={toDate=>setFilters({...filters,toDate})}/></label>
      {!employeeId && <label className="text-sm font-bold">Search staff<input type="search" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={staffSearch} placeholder="Name or staff ID" onChange={e=>setStaffSearch(e.target.value)}/></label>}
      {!employeeId && <label className="text-sm font-bold">Staff<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}><option value="">All staff</option>{filteredStaffOptions.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      <label className="text-sm font-bold">Home gym<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.homeGymId} onChange={e=>setFilters({...filters,homeGymId:e.target.value})}><option value="">All gyms</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="text-sm font-bold">Worked gym<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.workedGymId} onChange={e=>setFilters({...filters,workedGymId:e.target.value})}><option value="">All gyms</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="text-sm font-bold">Status<select className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option><option value="corrected">Corrected</option><option value="needs_attention">Needs Attention</option></select></label>
    </div>
    <div className="flex flex-wrap gap-2"><button onClick={()=>setPreset("week")} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">This week</button><button onClick={()=>setPreset("month")} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">This month</button><span className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-black">Custom</span>{focus!=="attendance" && <label className="ml-auto flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black"><input type="checkbox" checked={includeSalary} onChange={e=>setIncludeSalary(e.target.checked)}/> Include salary</label>}</div>

    <div className="flex flex-wrap gap-2"><button onClick={printReport} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-black text-white"><Printer className="h-4 w-4"/>Print / Save PDF</button><button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Download className="h-4 w-4"/>Export Excel</button><button onClick={()=>void emailReports(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Mail className="h-4 w-4"/>Email selected</button><button onClick={()=>void emailReports(false)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black"><Mail className="h-4 w-4"/>Email all filtered</button><button onClick={openManualPunch} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-sm font-black text-white"><Clock3 className="h-4 w-4"/>Manual Punch</button></div>

    {data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Staff" value={String(data.summary.employeeCount)}/><Stat label="Selected Period" value={duration(data.summary.workedMinutes)}/><Stat label="Needs Attention" value={String(data.summary.needsAttention)}/>{showSalary && <Stat label="Normal pay" value={money(data.summary.normalPayCents)}/>} {showSalary && <Stat label="Public holiday pay" value={money(data.summary.holidayPayCents)}/>} {showSalary && <Stat label="Total calculated pay" value={money(data.summary.payCents)}/>}</div>}

    <div className="space-y-5">{reports.map(report=><article key={report.employee.id} className="overflow-hidden rounded-2xl border border-zinc-200"><div className="flex flex-wrap justify-between gap-2 bg-zinc-50 px-4 py-3"><div><h3 className="font-black">{report.employee.name}</h3><p className="text-xs text-zinc-500">Home gym: {report.employee.homeGymName||"—"}{!report.employee.email && " · missing email"}</p></div><div className="text-right text-sm"><strong>{duration(report.selectedPeriod.workedMinutes)}</strong>{showSalary && <span className="ml-3 font-black text-orange-700">{money(report.selectedPeriod.payCents)}</span>}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-white text-xs uppercase text-zinc-500"><tr>{["Date","IN","IN gym","OUT","OUT gym","Status","Holiday / rate snapshot","Daily total",...(showSalary?["Normal pay","Public holiday pay","Total calculated pay"]:[]),""].map(h=><th key={h} className="px-3 py-2 font-black">{h}</th>)}</tr></thead><tbody>{report.days.flatMap(day=>day.allocations.map((allocation,index)=><tr key={allocation.id} className="border-t border-zinc-100"><td className="px-3 py-2">{formatEuropeanDate(day.date)}</td><td className="px-3 py-2">{formatEuropeanDateTime(allocation.clockInAt)}</td><td className="px-3 py-2">{allocation.clockInGymName||"—"}</td><td className="px-3 py-2">{allocation.clockOutAt?formatEuropeanDateTime(allocation.clockOutAt):"OPEN"}</td><td className="px-3 py-2">{allocation.clockOutGymName||"—"}</td><td className="px-3 py-2"><span className={allocation.attentionCode?"font-black text-red-700":allocation.status==="open"?"font-black text-amber-700":"font-bold"}>{allocation.attentionCode||allocation.status}</span></td><td className="px-3 py-2 text-xs"><strong>{allocation.holidayName || "Normal day"}</strong><br/>{multiplierLabel(allocation.holidayMultiplierBps)} · {employmentLabel(allocation.employmentType)}</td><td className="px-3 py-2 font-bold">{index===0?duration(day.workedMinutes):""}</td>{showSalary && <><td className="px-3 py-2">{index===0?money(day.normalPayCents):""}</td><td className="px-3 py-2">{index===0?money(day.holidayPayCents):""}</td><td className="px-3 py-2 font-black">{index===0?money(day.payCents):""}</td></>}<td className="px-3 py-2"><button onClick={()=>{const session=report.sessions.find(row=>row.id===allocation.sessionId);if(session)openCorrection(session);}} className="inline-flex items-center gap-1 font-black text-orange-700"><Wrench className="h-3.5 w-3.5"/>Correct Session</button></td></tr>))}</tbody></table></div><div className="grid gap-3 border-t border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-3"><div><p className="text-xs font-black uppercase text-zinc-500">Daily total</p><p className="text-sm">Shown per day above</p></div><div><p className="text-xs font-black uppercase text-zinc-500">Weekly</p><p className="text-sm">{report.weeklyTotals.map(row=>`${formatEuropeanDate(row.key)}: ${duration(row.workedMinutes)}`).join(" · ")||"—"}</p></div><div><p className="text-xs font-black uppercase text-zinc-500">Monthly</p><p className="text-sm">{report.monthlyTotals.map(row=>`${row.key}: ${duration(row.workedMinutes)}`).join(" · ")||"—"}</p></div></div></article>)}{!busy && reports.length===0 && <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">No attendance records match these filters.</p>}</div>

    {embedded && adjustments.length>0 && <section className="rounded-2xl border border-zinc-200 p-4"><h3 className="font-black">Attendance adjustments</h3><div className="mt-3 space-y-2">{adjustments.map(row=><div key={row.id} className="rounded-xl bg-zinc-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{row.action.replaceAll("_"," ")}</strong><span>{formatEuropeanDateTime(row.actionTime)}</span></div><p className="mt-1 text-zinc-600">Reason: {row.reason||"—"}</p></div>)}</div></section>}

    {manualPunchDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="manual-punch-title" className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Super Admin attendance action</p><h3 id="manual-punch-title" className="text-xl font-black">Manual Punch</h3></div><button type="button" onClick={()=>setManualPunchDraft(null)} aria-label="Close Manual Punch" className="rounded-xl p-2 hover:bg-zinc-100"><X className="h-5 w-5"/></button></div><p className="mt-2 text-sm text-zinc-500">Use this only when the normal punch hardware or attendance flow could not be used. The reason is stored in the audit trail.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Gym<select value={manualPunchDraft.gymId} onChange={e=>setManualPunchDraft({...manualPunchDraft,gymId:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5"><option value="">Choose gym</option>{(data?.gyms||[]).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label className="text-sm font-bold">Punch date<EuropeanDateInput ariaLabel="Punch date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={manualPunchDraft.date} max={today} onValueChange={date=>setManualPunchDraft({...manualPunchDraft,date})}/></label><label className="text-sm font-bold">Punch time<input type="time" value={manualPunchDraft.time} onChange={e=>setManualPunchDraft({...manualPunchDraft,time:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5"/></label><label className="text-sm font-bold sm:col-span-2">Reason<textarea value={manualPunchDraft.reason} onChange={e=>setManualPunchDraft({...manualPunchDraft,reason:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" placeholder="Mandatory reason for manual attendance action"/></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setManualPunchDraft(null)} className="rounded-xl border border-zinc-300 px-4 py-2 font-black">Cancel</button><button type="button" disabled={busy} onClick={()=>void submitManualPunch()} className="rounded-xl bg-orange-600 px-4 py-2 font-black text-white disabled:opacity-50">Save Manual Punch</button></div></div></div>}

    {correctionDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="correct-session-title" className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Super Admin attendance action</p><h3 id="correct-session-title" className="text-xl font-black">Correct Session</h3></div><button type="button" onClick={()=>setCorrectionDraft(null)} aria-label="Close Correct Session" className="rounded-xl p-2 hover:bg-zinc-100"><X className="h-5 w-5"/></button></div>{correctionDraft.session.attentionCode && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">This session is flagged for review: {correctionDraft.session.attentionCode}. Saving the correction will submit reviewMidnight for the flagged session.</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Correct IN date<EuropeanDateInput ariaLabel="Correct IN date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={correctionDraft.inDate} max={today} onValueChange={inDate=>setCorrectionDraft({...correctionDraft,inDate})}/></label><label className="text-sm font-bold">Correct IN time<input type="time" value={correctionDraft.inTime} onChange={e=>setCorrectionDraft({...correctionDraft,inTime:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5"/></label><label className="text-sm font-bold">Correct OUT date<EuropeanDateInput ariaLabel="Correct OUT date" className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" value={correctionDraft.outDate} min={correctionDraft.inDate || undefined} max={today} onValueChange={outDate=>setCorrectionDraft({...correctionDraft,outDate})}/></label><label className="text-sm font-bold">Correct OUT time<input type="time" value={correctionDraft.outTime} onChange={e=>setCorrectionDraft({...correctionDraft,outTime:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5"/></label><label className="text-sm font-bold sm:col-span-2">Reason<textarea value={correctionDraft.reason} onChange={e=>setCorrectionDraft({...correctionDraft,reason:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border border-zinc-300 p-2.5" placeholder="Mandatory reason for correcting this session"/></label></div><p className="mt-2 text-xs text-zinc-500">Leave both OUT fields blank only when the session should remain open.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setCorrectionDraft(null)} className="rounded-xl border border-zinc-300 px-4 py-2 font-black">Cancel</button><button type="button" disabled={busy} onClick={()=>void submitCorrection()} className="rounded-xl bg-orange-600 px-4 py-2 font-black text-white disabled:opacity-50">Save Correct Session</button></div></div></div>}

    <span className="hidden">IN OUT reason staff-attendance/timesheets manual-punch sessions/ reviewMidnight</span>
  </section>;
}

function Stat({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
