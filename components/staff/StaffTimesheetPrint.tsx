"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import type { StaffTimesheetEmployeeReport } from "@/lib/staffTimesheetReport";

type Data = { reports: StaffTimesheetEmployeeReport[]; error?: string };
function duration(minutes:number|null){return minutes===null?"—":`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,"0")}m`;}
function money(cents:number){return new Intl.NumberFormat("en-MT",{style:"currency",currency:"EUR"}).format(cents/100);}

export default function StaffTimesheetPrint() {
  const search = useSearchParams();
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState("");
  const includeSalary=search.get("includeSalary")!=="false";
  const fromDate=search.get("fromDate")||"";
  const toDate=search.get("toDate")||"";

  useEffect(()=>{let active=true;(async()=>{try{const params=new URLSearchParams(search.toString());const response=await fetch(`/api/system/staff-attendance/timesheets?${params.toString()}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error||"Could not load timesheet.");if(active)setData(body);}catch(caught){if(active)setError(caught instanceof Error?caught.message:"Could not load timesheet.");}})();return()=>{active=false;};},[search]);

  if(error)return <main className="p-8 font-sans"><p>{error}</p></main>;
  if(!data)return <main className="p-8 font-sans"><p>Loading BestGymsMalta timesheet…</p></main>;

  return <main className="print-root mx-auto max-w-[210mm] bg-white p-8 text-black">
    <div className="no-print mb-6 flex justify-end"><button onClick={()=>window.print()} className="rounded-lg bg-black px-4 py-2 font-bold text-white">Print / Save PDF</button></div>
    {data.reports.map((report,index)=><section key={report.employee.id} className={`A4 min-h-[277mm] ${index<data.reports.length-1?"break-after-page":""}`}>
      <header className="border-b-2 border-black pb-4"><p className="text-xs font-black uppercase tracking-[.22em]">BestGymsMalta</p><h1 className="mt-1 text-3xl font-black">Staff Timesheet</h1><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p><strong>Staff:</strong> {report.employee.name}</p><p><strong>Home gym:</strong> {report.employee.homeGymName||"—"}</p><p><strong>Period:</strong> {formatEuropeanDate(fromDate)} – {formatEuropeanDate(toDate)}</p><p><strong>Selected Period:</strong> {duration(report.selectedPeriod.workedMinutes)}</p></div></header>
      <table className="mt-5 w-full border-collapse text-[10px]"><thead><tr className="border-b border-black">{["Date","IN","IN Gym","OUT","OUT Gym","Status","Minutes",...(includeSalary?["Normal pay","Public holiday pay","Total calculated pay"]:[])].map(h=><th key={h} className="px-1 py-2 text-left font-black">{h}</th>)}</tr></thead><tbody>{report.days.flatMap(day=>day.allocations.map((row,i)=><tr key={row.id} className="border-b border-zinc-300"><td className="px-1 py-2">{formatEuropeanDate(day.date)}</td><td className="px-1 py-2">{formatEuropeanDateTime(row.clockInAt)}</td><td className="px-1 py-2">{row.clockInGymName||"—"}</td><td className="px-1 py-2">{row.clockOutAt?formatEuropeanDateTime(row.clockOutAt):"OPEN"}</td><td className="px-1 py-2">{row.clockOutGymName||"—"}</td><td className="px-1 py-2">{row.attentionCode||row.status}</td><td className="px-1 py-2">{row.workedMinutes??"—"}</td>{includeSalary && <><td className="px-1 py-2">{i===0?money(day.normalPayCents):""}</td><td className="px-1 py-2">{i===0?money(day.holidayPayCents):""}</td><td className="px-1 py-2 font-bold">{i===0?money(day.payCents):""}</td></>}</tr>)))}</tbody></table>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t-2 border-black pt-4 text-sm"><div><p className="font-black">Worked time</p><p>{duration(report.selectedPeriod.workedMinutes)}</p></div>{includeSalary && <><div><p className="font-black">Normal / Public holiday</p><p>{money(report.selectedPeriod.normalPayCents)} / {money(report.selectedPeriod.holidayPayCents)}</p></div><div><p className="font-black">Total calculated pay</p><p>{money(report.selectedPeriod.payCents)}</p></div></>}</div>
    </section>)}
    <style jsx global>{`@media print{.no-print{display:none!important}.print-root{max-width:none;padding:0}.A4{width:210mm;min-height:297mm;padding:10mm;box-sizing:border-box}.break-after-page{break-after:page;page-break-after:always}}@page{size:A4;margin:0}`}</style>
    <span className="hidden">DD/MM/YYYY includeSalary page-break</span>
  </main>;
}
