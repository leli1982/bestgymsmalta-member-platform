"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Camera,
  Dumbbell,
  MapPinned,
  RefreshCw,
  Users,
} from "lucide-react";

type AnalyticsData = {
  overview: {
    activeMembers: number;
    totalMembers: number;
    activeGyms: number;
    checkinsToday: number;
    checkinsThisWeek: number;
    strengthLogs: number;
    progressPhotos: number;
  };
  mostVisitedGyms: {
    gymId: string;
    gymName: string;
    gymCity: string;
    count: number;
  }[];
  latestCheckins: {
    id: string;
    memberName: string;
    memberNumber: string;
    gymName: string;
    checkinAt: string;
    source: string;
  }[];
  generatedAt: string;
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[#fcb415]">{icon}</div>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
        {label}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/analytics", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not load analytics.");
      }

      setData(json);
      setStatus("Analytics refreshed.");
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error ? error.message : "Could not load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Admin Analytics
            </p>
            <h2 className="mt-2 text-3xl font-black text-white">
              Member app overview
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Check member activity, app usage and gym visits at a glance.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAnalytics}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-3 text-sm font-black text-black"
          >
            <RefreshCw size={16} strokeWidth={3} />
            Refresh
          </button>
        </div>

        {status ? (
          <p className="mt-4 text-sm font-bold text-white/45">{status}</p>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm font-bold text-white/50">
          Loading analytics…
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<Users size={23} strokeWidth={3} />}
              label="Active members"
              value={data.overview.activeMembers}
            />
            <StatCard
              icon={<Activity size={23} strokeWidth={3} />}
              label="Check-ins today"
              value={data.overview.checkinsToday}
            />
            <StatCard
              icon={<BarChart3 size={23} strokeWidth={3} />}
              label="This week"
              value={data.overview.checkinsThisWeek}
            />
            <StatCard
              icon={<MapPinned size={23} strokeWidth={3} />}
              label="Active gyms"
              value={data.overview.activeGyms}
            />
            <StatCard
              icon={<Dumbbell size={23} strokeWidth={3} />}
              label="Strength logs"
              value={data.overview.strengthLogs}
            />
            <StatCard
              icon={<Camera size={23} strokeWidth={3} />}
              label="Progress photos"
              value={data.overview.progressPhotos}
            />
            <StatCard
              icon={<Users size={23} strokeWidth={3} />}
              label="Total members"
              value={data.overview.totalMembers}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Last 30 days
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Most visited gyms
              </h3>

              <div className="mt-5 space-y-3">
                {data.mostVisitedGyms.length ? (
                  data.mostVisitedGyms.map((gym, index) => (
                    <div
                      key={gym.gymId}
                      className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/25 p-4"
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/30">
                          #{index + 1}
                        </p>
                        <p className="mt-1 font-black text-white">
                          {gym.gymName}
                        </p>
                        {gym.gymCity ? (
                          <p className="mt-1 text-xs font-bold text-white/40">
                            {gym.gymCity}
                          </p>
                        ) : null}
                      </div>

                      <p className="text-2xl font-black text-[#fcb415]">
                        {gym.count}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-white/45">
                    No check-ins yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Live activity
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Latest check-ins
              </h3>

              <div className="mt-5 space-y-3">
                {data.latestCheckins.length ? (
                  data.latestCheckins.map((checkin) => (
                    <div
                      key={checkin.id}
                      className="rounded-3xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black text-white">
                            {checkin.memberName}
                          </p>
                          <p className="mt-1 text-xs font-bold text-white/40">
                            {checkin.memberNumber || "No member number"}
                          </p>
                        </div>

                        <p className="text-right text-xs font-black text-[#fcb415]">
                          {formatDate(checkin.checkinAt)}
                        </p>
                      </div>

                      <p className="mt-3 text-sm font-bold text-white/60">
                        {checkin.gymName}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-white/45">
                    No recent check-ins yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
