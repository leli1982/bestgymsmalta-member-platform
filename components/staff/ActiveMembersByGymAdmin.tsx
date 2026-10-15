"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, UsersRound } from "lucide-react";

type GymRow = {
  gymId: string;
  gymName: string;
  gymStatus: string;
  activeMembers: number;
};

type Data = {
  totalActiveMembers: number;
  assignedActiveMembers: number;
  unassignedActiveMembers: number;
  gyms: GymRow[];
  definition: string;
};

const fmt = new Intl.NumberFormat("en-GB");

function statusLabel(status: string) {
  if (status === "coming_soon") return "Coming soon";
  if (status === "inactive") return "Inactive gym";
  return "Active gym";
}

export default function ActiveMembersByGymAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/active-member-gym-stats", {
        cache: "no-store",
        signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load active member statistics.");
      if (!signal.aborted) setData(json as Data);
    } catch (requestError) {
      if (signal.aborted) return;
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Could not load active member statistics.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  const max = useMemo(
    () => Math.max(1, ...(data?.gyms || []).map((gym) => gym.activeMembers)),
    [data]
  );

  return (
    <section aria-label="Active members by gym" className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-700">
            <UsersRound className="h-4 w-4" /> Current membership base
          </p>
          <h2 className="mt-1 text-2xl font-black">Active members by gym</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Uses the member&apos;s current enrollment gym first. If no current enrollment gym is saved, the member&apos;s Original Gym is used.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setRefreshToken((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-900 disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" /> {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">
          {error}
        </p>
      )}

      {data && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-black text-orange-800">Total active members</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.totalActiveMembers)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Assigned to a gym</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.assignedActiveMembers)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black text-zinc-600">Unassigned</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{fmt.format(data.unassignedActiveMembers)}</p>
            </div>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-lg font-black">Gym breakdown</h3>
            <div className="mt-4 space-y-3" role="img" aria-label={"Active members by gym: " + data.gyms.map((gym) => gym.gymName + " " + gym.activeMembers).join("; ")}>
              {data.gyms.map((gym) => (
                <div key={gym.gymId} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-zinc-950">{gym.gymName}</p>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">{statusLabel(gym.gymStatus)}</p>
                    </div>
                    <p className="text-lg font-black tabular-nums text-zinc-950">{fmt.format(gym.activeMembers)}</p>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{ width: (gym.activeMembers / max * 100) + "%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">{data.definition}</p>
        </>
      )}
    </section>
  );
}
