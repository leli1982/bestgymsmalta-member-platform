"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, RefreshCw, ScanLine, UsersRound } from "lucide-react";
import { isValidCalendarDate, todayMaltaDate } from "@/lib/maltaDate";
import type { VisitGym } from "@/lib/scanVisitStatsCore";

type Gym = { id: string; name: string };
type Data = {
  range: { from: string; to: string; gymId: string; gymName: string };
  visits: number;
  uniqueMembers: number;
  gymsWithVisits: number;
  byGym: VisitGym[];
  byDay: Array<{ date: string; visits: number }>;
  byHour: Array<{ hour: number; visits: number }>;
  definition: string;
};
const controlClass = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-950";
const fmt = new Intl.NumberFormat("en-GB");
function daysAgo(today: string, numberOfDays: number) {
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - numberOfDays);
  return date.toISOString().slice(0, 10);
}
function BarRows({
  title, rows, selectedId, onSelect,
}: {
  title: string;
  rows: Array<{ gymId: string; gymName: string; visits: number; uniqueMembers: number }>;
  selectedId?: string | null;
  onSelect?: (gymId: string) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.visits));
  return (
    <section aria-label={title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-lg font-black">{title}</h3>
      {!rows.length ? <p className="mt-3 text-sm text-zinc-600">No recorded check-ins for this selection.</p> :
        <div className="mt-4 space-y-2">
          {rows.map((row) => {
            const selected = selectedId === row.gymId;
            const content = (
              <>
                <span className="flex items-start justify-between gap-3 text-sm font-black text-zinc-950">
                  <span className="text-left">{row.gymName}</span>
                  <span className="shrink-0 tabular-nums">{fmt.format(row.visits)} {row.visits === 1 ? "visit" : "visits"}</span>
                </span>
                <span className="mt-2 block h-3 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[#ff5a0a]" style={{ width: (row.visits / max * 100) + "%" }}/>
                </span>
                <span className="mt-1 block text-left text-xs font-semibold text-zinc-500">{fmt.format(row.uniqueMembers)} distinct {row.uniqueMembers === 1 ? "member" : "members"}{onSelect ? " · View enrollment breakdown →" : ""}</span>
              </>
            );
            return onSelect ? (
              <button type="button" key={row.gymId} aria-pressed={selected}
                onClick={() => onSelect(row.gymId)}
                className={"block w-full rounded-xl border px-3 py-3 text-left transition hover:border-orange-400 focus-visible:outline-2 focus-visible:outline-orange-600 " +
                  (selected ? "border-orange-500 bg-orange-50" : "border-zinc-200 bg-white")}>
                {content}
              </button>
            ) : (
              <div key={row.gymId} className="rounded-xl border border-zinc-200 bg-white px-3 py-3">{content}</div>
            );
          })}
        </div>}
    </section>
  );
}
function TimeBars({
  title, points, maxPoints,
}: {
  title: string;
  points: Array<{ label: string; visits: number }>;
  maxPoints?: number;
}) {
  const max = Math.max(1, ...points.map((point) => point.visits));
  return (
    <section aria-label={title} className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-black"><Clock3 className="h-5 w-5 text-orange-600"/>{title}</h3>
      {!points.some((point) => point.visits) ?
        <p className="mt-3 text-sm text-zinc-600">No check-ins during this period.</p> :
        <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-2" role="img"
          aria-label={title + ": " + points.filter((point) => point.visits > 0).map((point) => point.label + " " + point.visits).join("; ")}>
          {points.map((point) => (
            <div key={point.label} title={point.label + ": " + point.visits + " check-ins"}
              className={"flex min-w-9 flex-col items-center justify-end gap-1 " + (maxPoints ? "flex-1" : "")}>
              <span className="text-[10px] font-black tabular-nums">{point.visits || ""}</span>
              <div className="flex h-28 w-full items-end rounded-t-lg bg-zinc-100">
                <div className="w-full rounded-t-lg bg-[#ff5a0a]" style={{ height: (point.visits / max * 100) + "%" }}/>
              </div>
              <span className="text-[10px] font-bold text-zinc-600">{point.label}</span>
            </div>
          ))}
        </div>}
    </section>
  );
}

export default function ScanVisitStatsAdmin() {
  const today = useMemo(() => todayMaltaDate(), []);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [filterGymId, setFilterGymId] = useState("");
  const [selectedGymId, setSelectedGymId] = useState("");
  const [from, setFrom] = useState(() => today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/gyms", { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) setGyms((json.gyms || []) as Gym[]);
      } catch { /* historical names still come from the report API */ }
    })();
    return () => { active = false; };
  }, []);
  const load = useCallback(async (signal: AbortSignal) => {
    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      setData(null);
      setError("Select valid From and To dates, with From on or before To.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to });
      if (filterGymId) query.set("gymId", filterGymId);
      const response = await fetch("/api/system/scan-visit-stats?" + query.toString(), {
        cache: "no-store", signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load gym check-in statistics.");
      if (!signal.aborted) {
        setData(json as Data);
        setSelectedGymId((selected) => {
          const available = (json as Data).byGym;
          if (filterGymId) return filterGymId;
          return available.some((gym) => gym.gymId === selected) ? selected : "";
        });
      }
    } catch (requestError) {
      if (signal.aborted) return;
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Could not load check-in statistics.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [from, to, filterGymId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  const selected = data?.byGym.find((gym) => gym.gymId === selectedGymId) || null;
  const dayPoints = (selected?.byDay || data?.byDay || []).map((day) => ({
    label: day.date.slice(5), visits: day.visits,
  }));
  const hourPoints = selected?.byHour || data?.byHour || [];
  function preset(period: "today" | "week" | "month") {
    setTo(today);
    setFrom(period === "today" ? today : period === "week" ? daysAgo(today, 6) : today.slice(0, 8) + "01");
  }

  return (
    <section aria-label="Gym check-in statistics" className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-700"><ScanLine className="h-4 w-4"/> Reception and visitor analytics</p>
          <h2 className="mt-1 text-2xl font-black">Gym check-in statistics</h2>
          <p className="mt-2 text-sm text-zinc-600">See which gyms receive the most scanned member visits and where those visitors enrolled. All dates and hours use Malta local time.</p>
        </div>
        <button type="button" onClick={() => setRefreshToken((n) => n + 1)} disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-40">
          <RefreshCw className="h-4 w-4"/>{loading ? "Loading…" : "Refresh visits"}
        </button>
      </div>

      <div aria-label="Gym check-in filters" className="grid items-end gap-3 rounded-2xl bg-zinc-50 p-4 sm:grid-cols-3">
        <label className="text-sm font-black">Gym
          <select aria-label="Check-in statistics gym" value={filterGymId} onChange={(e) => setFilterGymId(e.target.value)} className={controlClass}>
            <option value="">All gyms combined</option>
            {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-black">From (Malta date)
          <input type="date" aria-label="Check-in statistics from date" value={from} onChange={(e) => setFrom(e.target.value)} className={controlClass}/>
        </label>
        <label className="text-sm font-black">To (Malta date)
          <input type="date" aria-label="Check-in statistics to date" value={to} onChange={(e) => setTo(e.target.value)} className={controlClass}/>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          {([["today", "Today"], ["week", "Last 7 days"], ["month", "This month"]] as const)
            .map(([key, label]) => <button type="button" key={key} onClick={() => preset(key)}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800">{label}</button>)}
          <span className="self-center text-xs text-zinc-500">Choose a gym above to filter; click a gym below to explore its visitors.</span>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
      {loading && !data && <p className="text-sm text-zinc-600">Loading check-in statistics…</p>}
      {data && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Check-in statistics summary">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-black text-orange-800">Recorded visits</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.visits)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Distinct visiting members</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.uniqueMembers)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Gyms visited</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.gymsWithVisits)}</p>
              <p className="mt-1 text-xs text-zinc-500">{data.range.from === data.range.to ? data.range.from : data.range.from + " → " + data.range.to}</p>
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <BarRows title="Check-ins by visited gym" rows={data.byGym} selectedId={selectedGymId}
              onSelect={(gymId) => setSelectedGymId((old) => old === gymId && !filterGymId ? "" : gymId)}/>
            <section aria-label="Selected gym enrollment breakdown" className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <h3 className="text-lg font-black">{selected ? "Visitors at " + selected.gymName : "Select a gym for its enrollment breakdown"}</h3>
              {selected ? <>
                <p className="text-sm font-semibold text-zinc-700">{fmt.format(selected.visits)} visits by {fmt.format(selected.uniqueMembers)} distinct members. Breakdown by the gym where the visiting members enrolled:</p>
                <BarRows title={"Enrollment gyms of visitors at " + selected.gymName} rows={selected.origins}/>
                <p className="text-xs text-zinc-600">Enrollment origin uses the gym currently saved on each member’s account. It does not change the gym where the check-in took place.</p>
              </> : <p className="text-sm text-zinc-700">Click Birkirkara, Marsa or another gym on the left to see where its visitors originally enrolled.</p>}
            </section>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2" aria-label="Check-in timing graphs">
            <TimeBars title={"Check-ins by date" + (selected ? " · " + selected.gymName : " · all gyms")}
              points={dayPoints} maxPoints={1}/>
            <TimeBars title={"Check-ins by hour (Malta)" + (selected ? " · " + selected.gymName : " · all gyms")}
              points={hourPoints.map((h) => ({ label: String(h.hour).padStart(2, "0") + ":00", visits: h.visits }))}/>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
            <p className="flex items-center gap-2 font-bold"><UsersRound className="h-4 w-4"/>Visits are not the same as unique members.</p>
            <p className="mt-1">{data.definition}</p>
          </div>
        </>
      )}
    </section>
  );
}
