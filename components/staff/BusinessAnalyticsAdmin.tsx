"use client";

import EuropeanDateInput from "@/components/ui/EuropeanDateInput";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, RefreshCw, Repeat2 } from "lucide-react";
import { todayMaltaDate } from "@/lib/maltaDate";

type Section = "overview" | "memberships" | "retention" | "revenue" | "usage" | "engagement" | "trends";
type Gym = { id: string; name: string };

type Analytics = any;

const euro = new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" });
const int = new Intl.NumberFormat("en-GB");

function money(cents: number) {
  return euro.format((Number(cents) || 0) / 100);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function durationLabel(value: string) {
  const labels: Record<string, string> = {
    "1_session": "1 Gym Session", "1_week": "1 week", "2_weeks": "2 weeks",
    "1_month": "1 month", "3_months": "3 months", "6_months": "6 months", "1_year": "1 year",
  };
  return labels[value] || value;
}

function typeLabel(value: string) {
  return ({ single: "Individual", student: "Student", couples: "Couples" } as Record<string, string>)[value] || value;
}

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-zinc-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Bars({
  title, rows, labelKey, valueKey, suffix = "", formatter,
}: {
  title: string; rows: any[]; labelKey: string; valueKey: string; suffix?: string; formatter?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-black">{title}</h3>
      {rows.length === 0 ? <p className="mt-3 text-sm font-semibold text-zinc-500">No data for this selection.</p> :
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const value = Number(row[valueKey] || 0);
            return (
              <div key={String(row[labelKey]) + index}>
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="truncate text-zinc-700">{String(row[labelKey])}</span>
                  <span className="shrink-0 tabular-nums text-zinc-950">{formatter ? formatter(value) : int.format(value)}{suffix}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-[#ff5a0a]" style={{ width: `${Math.max(value > 0 ? 3 : 0, value / max * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>}
    </section>
  );
}

function TrendTable({ rows, mode }: { rows: any[]; mode: "month" | "week" }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 p-4"><h3 className="font-black">{mode === "month" ? "Monthly trend" : "Weekly trend"}</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">New</th><th className="px-4 py-3">Renewals</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Revenue</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-black">{mode === "month" ? monthLabel(row.period) : "Week of " + row.period}</td>
                <td className="px-4 py-3 tabular-nums">{row.newMemberships}</td>
                <td className="px-4 py-3 tabular-nums">{row.renewals}</td>
                <td className="px-4 py-3 font-black tabular-nums">{row.total}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{money(row.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BusinessAnalyticsAdmin({ section }: { section: Section }) {
  const today = useMemo(() => todayMaltaDate(), []);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 11, 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retentionView, setRetentionView] = useState<"month" | "week" | "gym">("month");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/gyms", { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) setGyms(json.gyms || []);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (gymId) params.set("gymId", gymId);
      const response = await fetch("/api/system/business-analytics?" + params.toString(), { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load analytics.");
      setData(json);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to, gymId]);

  useEffect(() => { void load(); }, [load]);

  function preset(kind: "30" | "90" | "year" | "12m") {
    const d = new Date(today + "T12:00:00Z");
    if (kind === "30") d.setUTCDate(d.getUTCDate() - 29);
    if (kind === "90") d.setUTCDate(d.getUTCDate() - 89);
    if (kind === "year") { d.setUTCMonth(0, 1); }
    if (kind === "12m") d.setUTCMonth(d.getUTCMonth() - 11, 1);
    setFrom(d.toISOString().slice(0, 10));
    setTo(today);
  }

  const filterBar = (
    <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-4 md:items-end">
      <label className="text-sm font-black">Gym
        <select value={gymId} onChange={(e) => setGymId(e.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm">
          <option value="">All gyms combined</option>
          {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-black">From
        <EuropeanDateInput value={from} onValueChange={setFrom} className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm" />
      </label>
      <label className="text-sm font-black">To
        <EuropeanDateInput value={to} onValueChange={setTo} className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm" />
      </label>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
        <RefreshCw className="h-4 w-4" /> {loading ? "Loading…" : "Refresh"}
      </button>
      <div className="flex flex-wrap gap-2 md:col-span-4">
        <button onClick={() => preset("30")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Last 30 days</button>
        <button onClick={() => preset("90")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Last 90 days</button>
        <button onClick={() => preset("year")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">This year</button>
        <button onClick={() => preset("12m")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Last 12 months</button>
      </div>
    </section>
  );

  if (error) return <div className="space-y-4">{filterBar}<p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</p></div>;
  if (!data) return <div className="space-y-4">{filterBar}<p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm font-semibold text-zinc-500">Loading analytics…</p></div>;

  const o = data.overview;

  return (
    <div className="space-y-5">
      {filterBar}

      {section === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="New memberships" value={int.format(o.newMemberships)} />
            <Card label="Renewals" value={int.format(o.renewals)} hint={o.renewalSharePct + "% of membership actions"} />
            <Card label="Membership revenue" value={money(o.membershipRevenueCents)} />
            <Card label="Current active members" value={int.format(o.currentActiveMembers)} />
            <Card label="Recorded visits" value={int.format(o.visits)} />
            <Card label="Unique visitors" value={int.format(o.uniqueVisitors)} />
            <Card label="Visits / active member" value={o.visitsPerActiveMember} />
            <Card label="Discounts given" value={money(o.totalDiscountCents)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendTable rows={data.memberships.byMonth} mode="month" />
            <Bars title="Membership actions by gym" rows={data.memberships.byGym.slice(0, 12)} labelKey="gymName" valueKey="total" />
          </div>
        </>
      )}

      {section === "memberships" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card label="New memberships" value={o.newMemberships} />
            <Card label="Renewals" value={o.renewals} />
            <Card label="Total actions" value={o.totalMembershipActions} />
          </div>
          <TrendTable rows={data.memberships.byMonth} mode="month" />
          <TrendTable rows={data.memberships.byWeek} mode="week" />
          <div className="grid gap-4 xl:grid-cols-3">
            <Bars title="By gym" rows={data.memberships.byGym} labelKey="gymName" valueKey="total" />
            <Bars title="Membership type" rows={data.memberships.byType.map((r: any) => ({ ...r, label: typeLabel(r.key) }))} labelKey="label" valueKey="count" />
            <Bars title="Membership duration" rows={data.memberships.byDuration.map((r: any) => ({ ...r, label: durationLabel(r.key) }))} labelKey="label" valueKey="count" />
          </div>
        </>
      )}

      {section === "retention" && (
        <>
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-3"><Repeat2 className="mt-0.5 h-6 w-6 text-orange-700"/><div>
              <h3 className="font-black text-orange-950">Retention definition</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-orange-900">{data.coverage.retention}</p>
            </div></div>
          </section>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card label="Eligible expiring contracts" value={data.retention.eligibleContracts} />
            <Card label="Reactivations after 30 days" value={data.retention.reactivationsAfter30Days} />
            <Card label="Selected view" value={retentionView === "month" ? "Monthly" : retentionView === "week" ? "Weekly" : "By gym"} />
          </div>
          <div className="flex flex-wrap gap-2">
            {([["month","Month by month"],["week","Week by week"],["gym","By gym"]] as const).map(([key,label]) => (
              <button key={key} type="button" onClick={() => setRetentionView(key)}
                className={`rounded-xl px-4 py-2.5 text-sm font-black ${retentionView === key ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white text-zinc-700"}`}>{label}</button>
            ))}
          </div>
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr><th className="px-4 py-3">Period / Gym</th><th className="px-4 py-3">Eligible</th><th className="px-4 py-3">7-day</th><th className="px-4 py-3">14-day</th><th className="px-4 py-3">30-day retention</th><th className="px-4 py-3">30-day churn</th></tr>
                </thead>
                <tbody>
                  {(retentionView === "month" ? data.retention.byMonth : retentionView === "week" ? data.retention.byWeek : data.retention.byGym).map((row: any) => (
                    <tr key={row.gymId || row.period} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-black">{row.gymName || (retentionView === "month" ? monthLabel(row.period) : "Week of " + row.period)}</td>
                      <td className="px-4 py-3">{row.eligible}</td>
                      <td className="px-4 py-3">{row.rate7}%</td>
                      <td className="px-4 py-3">{row.rate14}%</td>
                      <td className="px-4 py-3 font-black text-emerald-700">{row.rate30}%</td>
                      <td className="px-4 py-3 font-black text-red-700">{row.churnRate30}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {section === "revenue" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Membership revenue" value={money(data.revenue.totalCents)} />
            <Card label="Average membership value" value={money(o.averageMembershipValueCents)} />
            <Card label="Discount value" value={money(data.revenue.discountCents)} />
            <Card label="Discounted memberships" value={data.revenue.discountedApplications} hint={data.revenue.averageDiscountPctOnDiscounted + "% average discount"} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 p-4"><h3 className="font-black">Revenue & average value by gym</h3></div>
              <div className="max-h-[420px] overflow-auto">
                {data.revenue.byGym.map((row: any) => (
                  <div key={row.gymId} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-zinc-100 px-4 py-3 text-sm">
                    <span className="font-black">{row.gymName}</span>
                    <span className="tabular-nums">{money(row.revenueCents)}</span>
                    <span className="font-bold tabular-nums text-zinc-500">{money(row.averageValueCents)} avg</span>
                  </div>
                ))}
              </div>
            </section>
            <Bars title="Revenue by payment method" rows={data.revenue.byPaymentMethod} labelKey="method" valueKey="revenueCents" formatter={money} />
            <Bars title="Revenue by month" rows={data.revenue.byMonth.map((r: any) => ({ ...r, label: monthLabel(r.period) }))} labelKey="label" valueKey="revenueCents" formatter={money} />
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Banknote className="h-7 w-7 text-amber-700"/><h3 className="mt-2 font-black text-amber-950">Outstanding balances</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{data.coverage.balances}</p>
            </section>
          </div>
        </>
      )}

      {section === "usage" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Visits" value={data.usage.visits} />
            <Card label="Unique visitors" value={data.usage.uniqueVisitors} />
            <Card label="Visits / active member" value={data.usage.visitsPerActiveMember} />
            <Card label="Cross-gym visits" value={data.usage.crossGymPct + "%"} hint={data.usage.verifiedOriginVisits + " visits with verified enrollment origin"} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 p-4"><h3 className="font-black">Check-ins & visits per active member by gym</h3></div>
              <div className="max-h-[440px] overflow-auto">
                {data.usage.byGym.map((row: any) => (
                  <div key={row.gymId} className="grid gap-1 border-t border-zinc-100 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto_auto]">
                    <span className="font-black">{row.gymName}</span>
                    <span>{row.visits} visits</span>
                    <span>{row.uniqueMembers} visitors</span>
                    <span className="font-black text-orange-700">{row.visitsPerActiveMember} / active member</span>
                  </div>
                ))}
              </div>
            </section>
            <Bars title="Peak hours" rows={data.usage.byHour.map((r: any) => ({ ...r, label: String(r.hour).padStart(2,"0") + ":00" }))} labelKey="label" valueKey="visits" />
            <Bars title="Peak days" rows={data.usage.byWeekday} labelKey="day" valueKey="visits" />
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="font-black">Home gym vs cross-gym behaviour</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Card label="Home-gym visits" value={data.usage.homeGymVisits} />
                <Card label="Cross-gym visits" value={data.usage.crossGymVisits} />
              </div>
            </section>
          </div>
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-4">
              <h3 className="font-black">Enrollment gym → gym actually visited</h3>
              <p className="mt-1 text-xs font-semibold text-zinc-500">Only visits with a verified enrollment-gym snapshot are included.</p>
            </div>
            <div className="max-h-[460px] overflow-auto">
              {data.usage.enrollmentToVisited.length === 0 ? <p className="p-5 text-sm font-semibold text-zinc-500">No verified movement data in this selection.</p> :
                data.usage.enrollmentToVisited.map((row: any, index: number) => (
                  <div key={row.enrollmentGymId + row.visitedGymId + index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 border-t border-zinc-100 px-4 py-3 text-sm">
                    <span className="font-black">{row.enrollmentGymName}</span>
                    <span className="font-black text-orange-600">→</span>
                    <span className="font-black">{row.visitedGymName}</span>
                    <span className="tabular-nums">{row.visits}</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {section === "engagement" && (
        <>
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold leading-6 text-orange-900">{data.coverage.engagement}</p>
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card label="Active members" value={data.engagement.currentActiveMembers} />
            <Card label="Inactive 30+ days" value={data.engagement.inactive30} />
            <Card label="Inactive 60+ days" value={data.engagement.inactive60} />
            <Card label="Inactive 90+ days" value={data.engagement.inactive90} />
            <Card label="No digital visit history yet" value={data.engagement.noDigitalVisitHistory} />
          </div>
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-4"><h3 className="font-black">Members with 30+ days since last recorded visit</h3><p className="mt-1 text-xs text-zinc-500">Top 100 longest inactive members with actual digital visit history.</p></div>
            <div className="max-h-[520px] overflow-auto">
              {data.engagement.inactiveMembers.length === 0 ? <p className="p-5 text-sm font-semibold text-zinc-500">No members match this condition.</p> :
                data.engagement.inactiveMembers.map((member: any) => (
                  <div key={member.memberNumber + member.lastVisit} className="grid gap-1 border-t border-zinc-100 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto]">
                    <div><p className="font-black">{member.fullName}</p><p className="text-xs font-semibold text-zinc-500">{member.memberNumber} · {member.gymName}</p></div>
                    <div className="text-zinc-600">Last visit: <strong>{member.lastVisit}</strong></div>
                    <div className="font-black text-red-700">{member.daysInactive} days</div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {section === "trends" && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Bars title="Busiest months · memberships + renewals" rows={data.trends.busiestMonths.map((r: any) => ({ ...r, label: monthLabel(r.period) }))} labelKey="label" valueKey="total" />
            <Bars title="Quietest recorded months" rows={data.trends.quietestMonths.map((r: any) => ({ ...r, label: monthLabel(r.period) }))} labelKey="label" valueKey="total" />
            <Bars title="Busiest weeks · memberships + renewals" rows={data.trends.busiestWeeks.map((r: any) => ({ ...r, label: "Week of " + r.period }))} labelKey="label" valueKey="total" />
            <Bars title="Quietest recorded weeks" rows={data.trends.quietestWeeks.map((r: any) => ({ ...r, label: "Week of " + r.period }))} labelKey="label" valueKey="total" />
          </div>
          <TrendTable rows={data.memberships.byMonth} mode="month" />
          <TrendTable rows={data.memberships.byWeek} mode="week" />
        </>
      )}
    </div>
  );
}
