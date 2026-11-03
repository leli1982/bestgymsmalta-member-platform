"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EuropeanDateInput from "@/components/ui/EuropeanDateInput";
import { RefreshCw, Smartphone, TrendingUp, UserCheck, UserMinus, UsersRound } from "lucide-react";

type DailyPoint = { date: string; count: number };
type AppAdoption = {
  totalEnrolled: number;
  trackedEnrolled: number;
  historicalUntracked: number;
  activeMembers: number;
  activeEnrolled: number;
  adoptionPct: number;
  notEnrolledActive: number;
  activatedToday: number;
  activatedThisWeek: number;
  activatedThisMonth: number;
  from: string;
  to: string;
  daily: DailyPoint[];
};

function maltaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

function KpiCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string | number;
  detail?: string;
  icon: typeof Smartphone;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-500">{label}</p>
        <Icon className="h-5 w-5 text-[#ff5a0a]" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-zinc-950">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold text-zinc-500">{detail}</p> : null}
    </div>
  );
}

export default function AppAdoptionAnalyticsAdmin() {
  const today = useMemo(() => maltaToday(), []);
  const [from, setFrom] = useState(() => addDays(today, -29));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AppAdoption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/system/app-adoption-analytics?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load app adoption analytics.");
      setData(json.appAdoption as AppAdoption);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load app adoption analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = Math.max(1, ...(data?.daily || []).map((point) => point.count));

  return (
    <div data-app-adoption-analytics="read-only" className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
            From
            <EuropeanDateInput
              value={from}
              max={to}
              onValueChange={setFrom}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900"
            />
          </label>
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
            To
            <EuropeanDateInput
              value={to}
              min={from}
              max={today}
              onValueChange={setTo}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      {data && data.historicalUntracked > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {data.historicalUntracked} existing app enrollment{data.historicalUntracked === 1 ? "" : "s"} predate precise activation tracking. They are included in Total enrolled and Adoption rate, but are not assigned invented dates in the daily chart.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total enrolled" value={data?.totalEnrolled ?? "—"} detail={data ? `${data.trackedEnrolled} with precise activation timestamps` : "All members who activated the app"} icon={Smartphone} />
        <KpiCard label="Adoption rate" value={data ? `${data.adoptionPct}%` : "—"} detail={data ? `${data.activeEnrolled} of ${data.activeMembers} active members` : undefined} icon={UsersRound} />
        <KpiCard label="Activated today" value={data?.activatedToday ?? "—"} icon={UserCheck} />
        <KpiCard label="Activated this week" value={data?.activatedThisWeek ?? "—"} icon={TrendingUp} />
        <KpiCard label="Activated this month" value={data?.activatedThisMonth ?? "—"} icon={TrendingUp} />
        <KpiCard label="Active not enrolled" value={data?.notEnrolledActive ?? "—"} detail="Current active members without app activation" icon={UserMinus} />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Daily app activations</h3>
            <p className="mt-1 text-xs font-semibold text-zinc-500">
              Precise first app activations for the selected date range. Zero-activation days are included.
            </p>
          </div>
          {data ? <p className="text-xs font-black text-zinc-500">{displayDate(data.from)} – {displayDate(data.to)}</p> : null}
        </div>

        {loading && !data ? (
          <div className="mt-5 h-52 animate-pulse rounded-xl bg-zinc-100" />
        ) : (
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex h-56 min-w-max items-end gap-2 border-b border-zinc-200 px-1">
              {(data?.daily || []).map((point) => {
                const height = point.count === 0 ? 3 : Math.max(12, Math.round((point.count / maxDaily) * 150));
                return (
                  <div key={point.date} className="flex w-9 flex-col items-center justify-end self-stretch pt-3">
                    <div className="flex flex-1 flex-col items-center justify-end">
                      <span className="mb-1 text-[11px] font-black text-zinc-700">{point.count}</span>
                      <div
                        title={`${displayDate(point.date)}: ${point.count} activation${point.count === 1 ? "" : "s"}`}
                        className="w-6 rounded-t-md bg-[#ff5a0a]"
                        style={{ height }}
                      />
                    </div>
                    <span className="mt-2 whitespace-nowrap text-[10px] font-bold text-zinc-500">{displayDate(point.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
