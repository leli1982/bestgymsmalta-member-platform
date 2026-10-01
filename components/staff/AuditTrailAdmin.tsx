"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { formatEuropeanDateTime, parseEuropeanDate } from "@/lib/europeanDate";

type Row = {
  id: string; created_at: string; system_user_id: string | null;
  system_username: string | null; system_display_name: string | null; system_is_super_admin: boolean | null;
  staff_name: string | null; context_gym_id: string | null; context_gym_name: string | null;
  action_key: string; entity_type: string; entity_id: string | null;
  member_id: string | null; member_number: string | null; member_name: string | null;
  before_data: unknown; after_data: unknown; category: string;
};
type UserOption = { id: string; username: string; display_name: string; is_super_admin: boolean; active: boolean };
type GymOption = { id: string; name: string; status: string };
type ResponseData = {
  rows: Row[]; total: number; page: number; pageSize: number;
  users: UserOption[]; gyms: GymOption[];
  summary: { today: number; thisWeek: number; memberChanges: number; financialChanges: number; systemChanges: number };
};

function pretty(value: unknown) {
  if (value === null || value === undefined) return "No data";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function label(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function AuditTrailAdmin() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", user: "", gym: "", action: "", entity: "", q: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("page", String(page));
    params.set("pageSize", "50");
    return params.toString();
  }, [applied, page]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/system/audit-trail?" + queryString, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load audit trail.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load audit trail.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { void load(); }, [load]);

  function applyFilters() {
    const from = filters.from ? parseEuropeanDate(filters.from) : "";
    const to = filters.to ? parseEuropeanDate(filters.to) : "";
    if ((filters.from && !from) || (filters.to && !to) || (from && to && from > to)) {
      setError("Enter a valid date range using DD/MM/YYYY.");
      return;
    }
    setError("");
    setPage(1);
    setApplied({ ...filters, from: from || "", to: to || "" });
  }
  function clearFilters() {
    const blank = { from: "", to: "", user: "", gym: "", action: "", entity: "", q: "" };
    setFilters(blank); setApplied(blank); setPage(1);
  }
  function exportUrl(all: boolean) {
    if (all) return "/api/system/audit-trail/export?all=1";
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, value); });
    return "/api/system/audit-trail/export?" + params.toString();
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4"/> Super Admin</a>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-700">Management</p>
            <h1 className="mt-1 text-3xl font-black">Audit Trail</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">A chronological record of audited member, financial, operations and system changes. Super Admin only.</p>
          </div>
          <ShieldCheck className="h-12 w-12 text-orange-600"/>
        </div>
      </header>

      {data && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Today", data.summary.today],
          ["This week", data.summary.thisWeek],
          ["Member changes", data.summary.memberChanges],
          ["Financial changes", data.summary.financialChanges],
          ["System/Admin changes", data.summary.systemChanges],
        ].map(([title, value]) => <div key={String(title)} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{title}</p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>)}
      </section>}

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-bold">From
            <input inputMode="numeric" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}
              placeholder="DD/MM/YYYY" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950"/>
          </label>
          <label className="text-sm font-bold">To
            <input inputMode="numeric" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}
              placeholder="DD/MM/YYYY" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950"/>
          </label>
          <label className="text-sm font-bold">User<select value={filters.user} onChange={e=>setFilters({...filters,user:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5">
            <option value="">All users</option>{(data?.users || []).map(u=><option key={u.id} value={u.id}>{u.display_name} · {u.username}{u.is_super_admin?" · Super Admin":""}</option>)}
          </select></label>
          <label className="text-sm font-bold">Gym<select value={filters.gym} onChange={e=>setFilters({...filters,gym:e.target.value})} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5">
            <option value="">All gyms</option>{(data?.gyms || []).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select></label>
          <label className="text-sm font-bold">Action<input value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value})} placeholder="e.g. voucher, card, refund" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950"/></label>
          <label className="text-sm font-bold">Entity<input value={filters.entity} onChange={e=>setFilters({...filters,entity:e.target.value})} placeholder="e.g. member" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950"/></label>
          <label className="text-sm font-bold xl:col-span-2">Search<input value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")applyFilters();}} placeholder="Member, BGM number, staff, username, entity ID…" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 placeholder:text-zinc-400 caret-zinc-950"/></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={applyFilters} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white"><Search className="h-4 w-4"/>Apply filters</button>
          <button onClick={clearFilters} className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-black">Clear</button>
          <button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-black"><RefreshCw className="h-4 w-4"/>Refresh</button>
          <a href={exportUrl(false)} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-black text-white"><Download className="h-4 w-4"/>Export filtered Excel</a>
          <a href={exportUrl(true)} className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-black text-orange-800"><Download className="h-4 w-4"/>Export complete Excel</a>
        </div>
      </section>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <p className="font-black">{loading ? "Loading…" : `${data?.total || 0} audit rows`}</p>
          <p className="text-sm text-zinc-500">Page {page} of {pages}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>{["Date & Time","Staff name","User","Gym","Action","Member","Entity",""].map(h=><th key={h} className="px-4 py-3 font-black">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(data?.rows || []).map(row => {
                const expanded=open===row.id;
                const effectiveStaff=row.staff_name || row.system_display_name || "Not recorded";
                return <tr key={row.id} className="border-t border-zinc-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatEuropeanDateTime(row.created_at)}</td>
                  <td className="px-4 py-3"><span className="font-bold">{effectiveStaff}</span>{!row.staff_name && row.system_display_name && <span className="mt-1 block text-[11px] text-zinc-400">from user record</span>}</td>
                  <td className="px-4 py-3"><span className="font-bold">{row.system_display_name || "Unknown user"}</span><span className="block font-mono text-xs text-zinc-500">{row.system_username || row.system_user_id || "—"}</span></td>
                  <td className="px-4 py-3">{row.context_gym_name || "—"}</td>
                  <td className="px-4 py-3"><span className="font-bold">{label(row.action_key)}</span><span className="block text-xs text-zinc-500">{row.action_key}</span></td>
                  <td className="px-4 py-3">{row.member_name || "—"}{row.member_number && <span className="block font-mono text-xs text-zinc-500">{row.member_number}</span>}</td>
                  <td className="px-4 py-3">{row.entity_type || "—"}{row.entity_id && <span className="block max-w-48 truncate font-mono text-xs text-zinc-500" title={row.entity_id}>{row.entity_id}</span>}</td>
                  <td className="px-4 py-3"><button onClick={()=>setOpen(expanded?"":row.id)} className="inline-flex items-center gap-1 font-black text-orange-700">Details <ChevronDown className={`h-4 w-4 transition ${expanded?"rotate-180":""}`}/></button>
                    {expanded && <div className="mt-3 grid min-w-[520px] gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-zinc-50 p-3"><p className="mb-2 text-xs font-black uppercase text-zinc-500">Before</p><pre className="whitespace-pre-wrap break-words text-xs">{pretty(row.before_data)}</pre></div>
                      <div className="rounded-xl bg-zinc-50 p-3"><p className="mb-2 text-xs font-black uppercase text-zinc-500">After</p><pre className="whitespace-pre-wrap break-words text-xs">{pretty(row.after_data)}</pre></div>
                    </div>}
                  </td>
                </tr>;
              })}
              {!loading && (data?.rows || []).length===0 && <tr><td colSpan={8} className="px-4 py-10 text-center font-semibold text-zinc-500">No audit rows match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 p-4">
          <button disabled={page<=1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Previous</button>
          <button disabled={page>=pages||loading} onClick={()=>setPage(p=>p+1)} className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black disabled:opacity-40">Next<ChevronRight className="h-4 w-4"/></button>
        </div>
      </section>
    </div>
  </main>;
}
