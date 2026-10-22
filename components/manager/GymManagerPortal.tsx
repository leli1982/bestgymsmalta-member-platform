"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EuropeanDateInput from "@/components/ui/EuropeanDateInput";
import { isValidCalendarDate, todayMaltaDate } from "@/lib/maltaDate";

type ManagerUser = {
  id: string;
  username: string;
  displayName: string;
  role: "gym_manager";
  managedGymIds: string[];
};

type ManagerStats = {
  range: { from: string; to: string; gymId: string | null };
  assignedGyms: Array<{ id: string; name: string }>;
  totals: { newMemberships: number; renewals: number; grandTotal: number };
  byGym: Array<{
    gymId: string;
    gymName: string;
    newMemberships: number;
    renewals: number;
    total: number;
  }>;
};

type QuickRange = "today" | "week" | "month";

const inputClass = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-950";

function startOfMaltaWeek(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export default function GymManagerPortal() {
  const today = useMemo(() => todayMaltaDate(), []);
  const [user, setUser] = useState<ManagerUser | null>(null);
  const [gymId, setGymId] = useState("");
  const [from, setFrom] = useState(() => today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRange | null>("month");
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState("");

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/system/auth", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      const sessionUser = data.authenticated ? data.user : null;
      if (sessionUser?.role === "gym_manager") {
        setUser(sessionUser as ManagerUser);
        setError("");
      } else {
        window.location.replace("/staff");
        return;
      }
    } catch {
      window.location.replace("/staff");
      return;
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => { void checkSession(); }, [checkSession]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    if (!isValidCalendarDate(from) || !isValidCalendarDate(to) || from > to) {
      setError("Select valid From and To dates, with From no later than To.");
      return;
    }
    setLoadingStats(true);
    setError("");
    try {
      const query = new URLSearchParams({ from, to });
      if (gymId) query.set("gymId", gymId);
      const response = await fetch(`/api/manager/membership-stats?${query.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load membership figures.");
      setStats(data as ManagerStats);
      if (gymId && !(data.assignedGyms || []).some((gym: { id: string }) => gym.id === gymId)) setGymId("");
    } catch (requestError) {
      setStats(null);
      setError(requestError instanceof Error ? requestError.message : "Could not load membership figures.");
    } finally {
      setLoadingStats(false);
    }
  }, [from, gymId, to, user]);

  useEffect(() => { if (user) void loadStats(); }, [user, loadStats]);

  const applyQuickRange = useCallback((range: QuickRange) => {
    const nextFrom = range === "today"
      ? today
      : range === "week"
        ? startOfMaltaWeek(today)
        : today.slice(0, 8) + "01";

    setFrom(nextFrom);
    setTo(today);
    setActiveQuickRange(range);
  }, [today]);

  async function logout() {
    await fetch("/api/system/auth", { method: "DELETE" });
    setUser(null);
    setStats(null);
    window.location.replace("/staff");
  }

  if (loadingSession || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">Loading…</main>;
  }

  const quickButtonClass = (range: QuickRange) => `rounded-xl border px-4 py-2 text-sm font-black transition ${
    activeQuickRange === range
      ? "border-zinc-950 bg-zinc-950 text-white"
      : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
  }`;

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
            <h1 className="mt-1 text-3xl font-black">Gym Manager Dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-zinc-600">{user.displayName}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-black">Sign out</button>
        </header>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Quick date filters">
            <button type="button" onClick={() => applyQuickRange("today")} className={quickButtonClass("today")}>Today</button>
            <button type="button" onClick={() => applyQuickRange("week")} className={quickButtonClass("week")}>This Week</button>
            <button type="button" onClick={() => applyQuickRange("month")} className={quickButtonClass("month")}>This Month</button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-black">Gym
              <select value={gymId} onChange={(event) => setGymId(event.target.value)} className={inputClass}>
                <option value="">All assigned gyms combined</option>
                {(stats?.assignedGyms || []).map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-black">From
              <EuropeanDateInput
                value={from}
                onValueChange={(value) => { setFrom(value); setActiveQuickRange(null); }}
                className={inputClass}
                ariaLabel="Manager report from date"
              />
            </label>
            <label className="text-sm font-black">To
              <EuropeanDateInput
                value={to}
                onValueChange={(value) => { setTo(value); setActiveQuickRange(null); }}
                className={inputClass}
                ariaLabel="Manager report to date"
              />
            </label>
          </div>
          <button type="button" onClick={() => void loadStats()} disabled={loadingStats} className="mt-4 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{loadingStats ? "Loading…" : "Refresh figures"}</button>
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}

        {stats && (
          <>
            <section className="grid gap-4 sm:grid-cols-3" aria-label="Manager membership totals">
              <Summary title="New memberships" value={stats.totals.newMemberships} />
              <Summary title="Renewals" value={stats.totals.renewals} />
              <Summary title="Grand total" value={stats.totals.grandTotal} emphasis />
            </section>

            <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 p-5">
                <h2 className="text-xl font-black">Gym breakdown</h2>
                <p className="mt-1 text-sm text-zinc-600">Only gyms assigned to this Manager are shown.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr><th className="px-5 py-3">Gym</th><th className="px-5 py-3 text-right">New</th><th className="px-5 py-3 text-right">Renewals</th><th className="px-5 py-3 text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {stats.byGym.map((gym) => (
                      <tr key={gym.gymId} className="border-t border-zinc-100">
                        <td className="px-5 py-4 font-black">{gym.gymName}</td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums">{gym.newMemberships}</td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums">{gym.renewals}</td>
                        <td className="px-5 py-4 text-right text-lg font-black tabular-nums">{gym.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Summary({ title, value, emphasis = false }: { title: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${emphasis ? "border-orange-200 bg-orange-50" : "border-zinc-200 bg-white"}`}>
      <p className={`text-sm font-black ${emphasis ? "text-orange-800" : "text-zinc-600"}`}>{title}</p>
      <p className="mt-2 text-4xl font-black tabular-nums">{value}</p>
    </div>
  );
}
