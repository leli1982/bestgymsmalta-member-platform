"use client";

import { useState } from "react";
import {
  Activity, ArrowLeft, Banknote, BarChart3, CalendarRange, ChartNoAxesCombined,
  Dumbbell, Repeat2, TrendingUp, UsersRound,
} from "lucide-react";
import BusinessAnalyticsAdmin from "@/components/staff/BusinessAnalyticsAdmin";
import MembershipStatsAdmin from "@/components/staff/MembershipStatsAdmin";
import ActiveMembersByGymAdmin from "@/components/staff/ActiveMembersByGymAdmin";
import ScanVisitStatsAdmin from "@/components/staff/ScanVisitStatsAdmin";

type View =
  | "overview"
  | "memberships"
  | "retention"
  | "revenue"
  | "usage"
  | "engagement"
  | "trends"
  | "new-memberships"
  | "active-members"
  | "checkins";

const options: Array<{
  key: View;
  label: string;
  description: string;
  icon: typeof BarChart3;
  group: "Business analytics" | "Detailed reports";
}> = [
  { key: "overview", label: "Overview", description: "Headline KPIs across memberships, revenue and visits.", icon: ChartNoAxesCombined, group: "Business analytics" },
  { key: "memberships", label: "Membership trends", description: "New vs renewals by month, week, gym, type and duration.", icon: UsersRound, group: "Business analytics" },
  { key: "retention", label: "Retention & churn", description: "7/14/30-day renewal retention, churn and reactivations.", icon: Repeat2, group: "Business analytics" },
  { key: "revenue", label: "Revenue & discounts", description: "Membership value, revenue by gym, discounts and payment methods.", icon: Banknote, group: "Business analytics" },
  { key: "usage", label: "Gym usage", description: "Cross-gym behaviour, visits/member, peak days and peak hours.", icon: Dumbbell, group: "Business analytics" },
  { key: "engagement", label: "Member activity", description: "30/60/90-day inactivity and members with no digital visit history.", icon: Activity, group: "Business analytics" },
  { key: "trends", label: "Busy periods", description: "Busiest months and weeks for new memberships and renewals.", icon: TrendingUp, group: "Business analytics" },
  { key: "new-memberships", label: "New memberships", description: "Existing detailed activation report with gym/date filters.", icon: CalendarRange, group: "Detailed reports" },
  { key: "active-members", label: "Active members by gym", description: "Existing live active-member base by enrollment gym.", icon: UsersRound, group: "Detailed reports" },
  { key: "checkins", label: "Check-in statistics", description: "Existing detailed visits, origins, dates and hours report.", icon: BarChart3, group: "Detailed reports" },
];

export default function StatisticsDashboardAdmin() {
  const [view, setView] = useState<View>("overview");
  const selected = options.find((option) => option.key === view)!;
  const SelectedIcon = selected.icon;

  return (
    <main data-super-admin-statistics="button-driven" className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
            <ArrowLeft className="h-4 w-4" /> Super Admin
          </a>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#ff5a0a]">BestGymsMalta · Insights</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Statistics & Analytics</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
            Choose one statistic below. Only the selected report is shown, so you can move between business insights without scrolling through every graph.
          </p>
        </header>

        {(["Business analytics", "Detailed reports"] as const).map((group) => (
          <section key={group} className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">{group}</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {options.filter((option) => option.group === group).map((option) => {
                const Icon = option.icon;
                const active = view === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setView(option.key)}
                    className={`min-h-[118px] rounded-2xl border p-4 text-left transition ${active
                      ? "border-[#ff5a0a] bg-orange-50 shadow-sm ring-2 ring-orange-100"
                      : "border-zinc-200 bg-white hover:border-orange-300"}`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-[#ff5a0a]" : "text-zinc-500"}`} />
                    <p className="mt-3 text-sm font-black text-zinc-950">{option.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-zinc-100 pb-4">
            <SelectedIcon className="mt-0.5 h-6 w-6 text-[#ff5a0a]" />
            <div>
              <h2 className="text-2xl font-black">{selected.label}</h2>
              <p className="mt-1 text-sm font-semibold text-zinc-500">{selected.description}</p>
            </div>
          </div>

          {view === "new-memberships" ? <MembershipStatsAdmin /> :
           view === "active-members" ? <ActiveMembersByGymAdmin /> :
           view === "checkins" ? <ScanVisitStatsAdmin /> :
           <BusinessAnalyticsAdmin section={view} />}
        </section>
      </div>
    </main>
  );
}
