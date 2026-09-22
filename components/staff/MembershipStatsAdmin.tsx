"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, RefreshCw, UsersRound } from "lucide-react";
import { todayMaltaDate, isValidCalendarDate } from "@/lib/maltaDate";

type Gym = { id: string; name: string };
type GymCount = { gymId: string; gymName: string; count: number };
type DayCount = { date: string; count: number };
type Stats = {
  range: { from: string; to: string; gymId: string; gymName: string };
  total: number; gymsWithEnrollments: number;
  byGym: GymCount[]; byDay: DayCount[];
  byType: Record<string, number>;
};

const inputStyle = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-950";
function dateDaysAgo(today: string, days: number) {
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
const membershipTypeLabels: Record<string, string> = {
  single: "Individual", couples: "Couples", student: "Student",
};

function ComparisonBars({ data, title }: { data: Array<{ name: string; count: number }>; title: string }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4" aria-label={title}>
      <h4 className="text-base font-black text-zinc-950">{title}</h4>
      {data.length === 0 ? <p className="mt-3 text-sm text-zinc-600">No activations in this selection.</p> :
        <div className="mt-4 space-y-3" role="img" aria-label={title + ": " + data.map((item) => item.name + " " + item.count).join("; ")}>
          {data.map((item) => (
            <div key={item.name}>
              <div className="flex justify-between gap-3 text-sm font-bold">
                <span className="text-zinc-800">{item.name}</span>
                <span className="tabular-nums text-zinc-950">{item.count}</span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-orange-500" style={{ width: (item.count / max * 100) + "%" }}/>
              </div>
            </div>
          ))}
        </div>}
    </section>
  );
}

export default function MembershipStatsAdmin() {
  const today = useMemo(() => todayMaltaDate(), []);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [from, setFrom] = useState(() => today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/gyms", { cache: "no-store" });
        const data = await response.json();
        if (mounted && response.ok) setGyms((data.gyms || []) as Gym[]);
      } catch { /* The stats API can still return historic gym names. */ }
    })();
    return () => { mounted = false; };
  }, []);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      setError("Select valid From and To dates, with From no later than To.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to });
      if (gymId) query.set("gymId", gymId);
      const response = await fetch("/api/system/membership-stats?" + query.toString(), {
        cache: "no-store", signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load new membership statistics.");
      if (!signal.aborted) setStats(data as Stats);
    } catch (requestError) {
      if (signal.aborted) return;
      setStats(null);
      setError(requestError instanceof Error ? requestError.message : "Could not load new membership statistics.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [from, to, gymId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  const typeChart = stats ? Object.entries(stats.byType)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({ name: membershipTypeLabels[name] || name, count })) : [];
  const groupChart = stats?.byGym.map((gym) => ({ name: gym.gymName, count: gym.count })) || [];
  const maxDay = Math.max(1, ...(stats?.byDay || []).map((day) => day.count));
  function setShortcut(days: "today" | "week" | "month") {
    if (days === "today") { setFrom(today); setTo(today); }
    if (days === "week") { setFrom(dateDaysAgo(today, 6)); setTo(today); }
    if (days === "month") { setFrom(today.slice(0, 8) + "01"); setTo(today); }
  }

  return (
    <section aria-label="New membership statistics" className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-700"><UsersRound className="h-4 w-4"/> Membership reporting</p>
          <h2 className="mt-1 text-2xl font-black">New membership statistics</h2>
          <p className="mt-2 text-sm text-zinc-600">Counts completed, activated NEW memberships by their Malta activation date. Renewals, pending and cancelled applications are excluded. A couples membership counts as one membership.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRefreshToken((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-900 disabled:opacity-40"><RefreshCw className="h-4 w-4"/>{loading ? "Loading…" : "Refresh stats"}</button>
      </div>

      <div className="grid items-end gap-3 rounded-2xl bg-zinc-50 p-4 sm:grid-cols-3" aria-label="Membership statistics filters">
        <label className="text-sm font-black">Gym
          <select aria-label="Membership statistics gym" className={inputStyle} value={gymId} onChange={(event) => setGymId(event.target.value)}>
            <option value="">All gyms combined</option>
            {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-black">From (Malta date)
          <input aria-label="Membership statistics from date" type="date" className={inputStyle} value={from} onChange={(event) => setFrom(event.target.value)}/>
        </label>
        <label className="text-sm font-black">To (Malta date)
          <input aria-label="Membership statistics to date" type="date" className={inputStyle} value={to} onChange={(event) => setTo(event.target.value)}/>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-3" aria-label="Membership date shortcuts">
          {([
            ["today", "Today"], ["week", "Last 7 days"], ["month", "This month"],
          ] as const).map(([key, title]) =>
            <button type="button" key={key} onClick={() => setShortcut(key)}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800">{title}</button>)}
          <span className="self-center text-xs text-zinc-500">For a custom range, set From and To above. Membership filters are independent of the Sundries/Bar filters.</span>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">{error}</p>}
      {loading && !stats && <p className="text-sm font-semibold text-zinc-600">Loading membership statistics…</p>}
      {stats && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Membership statistics summary">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-black text-orange-800">New memberships</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-zinc-950">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Gyms with new memberships</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{stats.gymsWithEnrollments}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Selected period</p>
              <p className="mt-3 flex items-center gap-2 text-sm font-black"><CalendarDays className="h-4 w-4 text-orange-600"/>{stats.range.from === stats.range.to ? stats.range.from : stats.range.from + " → " + stats.range.to}</p>
              <p className="mt-2 text-xs font-semibold text-zinc-500">{stats.range.gymName}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2" aria-label="New membership graphs">
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4" aria-label="New memberships by activation date">
              <h3 className="flex items-center gap-2 text-base font-black"><BarChart3 className="h-5 w-5 text-orange-600"/> New memberships by date</h3>
              <p className="mt-1 text-xs text-zinc-600">Dates with activations, in Malta local time; dates with zero are omitted.</p>
              {stats.byDay.length === 0 ? <p className="mt-4 text-sm font-bold text-zinc-600">No new memberships in this period.</p> :
                <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2" role="img" aria-label={"New memberships by activation date: " + stats.byDay.map((day) => day.date + " " + day.count).join("; ")}>
                  {stats.byDay.map((day) => (
                    <div key={day.date} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-xs font-black tabular-nums">{day.count}</span>
                      <div className="flex h-32 w-full items-end rounded-t-lg bg-zinc-200">
                        <div className="w-full rounded-t-lg bg-orange-500" style={{ height: (day.count / maxDay * 100) + "%" }}/>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600">{day.date.slice(5)}</span>
                    </div>
                  ))}
                </div>}
            </section>
            <ComparisonBars title={gymId ? "Membership types at " + stats.range.gymName : "New memberships by gym"}
              data={gymId ? typeChart : groupChart}/>
          </div>

          <ComparisonBars title="Membership types (selected gyms and dates)" data={typeChart}/>
          {!gymId && stats.byGym.length > 0 && (
            <section aria-label="Gym membership totals" className="rounded-2xl border border-zinc-200 p-4">
              <h3 className="text-base font-black">Gym breakdown</h3>
              <div className="mt-3 space-y-2">
                {stats.byGym.map((gym) => <div key={gym.gymId} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm font-semibold">
                  <span>{gym.gymName}</span><strong className="tabular-nums">{gym.count}</strong>
                </div>)}
              </div>
              <p className="mt-3 text-xs text-zinc-500">These gym counts sum to the new membership total shown above.</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
