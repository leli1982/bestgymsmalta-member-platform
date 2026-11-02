"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, RefreshCw, ScanLine, TriangleAlert, UserCheck, UsersRound, WalletCards } from "lucide-react";

type Gym = { id: string; name: string; status: string };
type FeedItem = { id: string; at: string; kind: string; tone: string; title: string; detail: string };
type MonitorData = {
  gyms: Gym[];
  gym?: Gym;
  businessDate: string;
  summary: null | {
    checkIns: number;
    acceptedScans: number;
    rejectedScans: number;
    membershipActions: number;
    barSubmissions: number;
    barTotalCents: number;
    auditActions: number;
  };
  feed: FeedItem[];
  generatedAt: string;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

function time(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function toneClasses(tone: string) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "warning") return "border-red-200 bg-red-50 text-red-950";
  if (tone === "financial") return "border-violet-200 bg-violet-50 text-violet-950";
  return "border-zinc-200 bg-white text-zinc-950";
}

export default function LiveGymMonitorAdmin() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/live-gym-monitor", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load gyms.");
        if (!active) return;
        const list: Gym[] = body.gyms || [];
        setGyms(list);
        const preferred = list.find((gym) => gym.status === "active") || list[0];
        if (preferred) setGymId(preferred.id);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load gyms.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const refresh = useCallback(async (selectedGymId: string, manual = false) => {
    if (!selectedGymId || inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/system/live-gym-monitor?gymId=${encodeURIComponent(selectedGymId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not refresh activity.");
      setData(body);
      setGyms(body.gyms || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh activity.");
    } finally {
      inFlight.current = false;
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!gymId) return;
    void refresh(gymId);
    const timer = window.setInterval(() => { void refresh(gymId); }, 5000);
    return () => window.clearInterval(timer);
  }, [gymId, refresh]);

  const summary = data?.summary;

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-5 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4" /> Super Admin</a>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3"><Activity className="h-8 w-8 text-orange-600" /><h1 className="text-3xl font-black tracking-tight">Live Gym Monitor</h1></div>
              <p className="mt-2 text-sm text-zinc-600">Read-only view of today&apos;s live gym activity. Auto-refreshes every 5 seconds.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-800"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Live</div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-black text-zinc-700">Gym
              <select value={gymId} onChange={(event) => setGymId(event.target.value)} disabled={loading || !gyms.length} className="mt-1 block min-h-12 w-full rounded-2xl border border-zinc-300 bg-white px-4 text-base font-bold text-black outline-none focus:border-orange-500">
                {!gyms.length && <option value="">No gyms available</option>}
                {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}{gym.status !== "active" ? ` (${gym.status})` : ""}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void refresh(gymId, true)} disabled={!gymId || refreshing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-black text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-zinc-500"><span>Business date: {data?.businessDate || "—"}</span><span>Last updated: {data?.generatedAt ? time(data.generatedAt) : "—"}</span>{data?.gym?.name && <span>Watching: <strong className="text-zinc-800">{data.gym.name}</strong></span>}</div>
          {error && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}
        </header>

        <section aria-label="Live totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-zinc-600"><UserCheck className="h-5 w-5 text-emerald-600" /> Check-ins today</div><p className="mt-3 text-4xl font-black">{summary?.checkIns ?? 0}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{summary?.acceptedScans ?? 0} granted access scans</p></div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-zinc-600"><TriangleAlert className="h-5 w-5 text-red-600" /> Rejected scans</div><p className="mt-3 text-4xl font-black">{summary?.rejectedScans ?? 0}</p><p className="mt-1 text-xs font-semibold text-zinc-500">Expired, inactive, unknown or disabled credentials</p></div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-zinc-600"><UsersRound className="h-5 w-5 text-orange-600" /> Membership actions</div><p className="mt-3 text-4xl font-black">{summary?.membershipActions ?? 0}</p><p className="mt-1 text-xs font-semibold text-zinc-500">Recorded member or membership activity today</p></div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-zinc-600"><WalletCards className="h-5 w-5 text-violet-600" /> Bar total</div><p className="mt-3 text-4xl font-black">{money(summary?.barTotalCents ?? 0)}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{summary?.barSubmissions ?? 0} Bar submission{summary?.barSubmissions === 1 ? "" : "s"}</p></div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Recent activity</h2><p className="mt-1 text-xs font-semibold text-zinc-500">Newest first. Scanner credentials themselves are never shown.</p></div><div className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500"><ScanLine className="h-4 w-4" /> {data?.feed?.length ?? 0} recent events</div></div>
          <div className="mt-4 space-y-2">
            {!data?.feed?.length && <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm font-semibold text-zinc-500">No activity recorded for this gym today yet.</div>}
            {(data?.feed || []).map((item) => (
              <article key={item.id} className={`flex gap-3 rounded-2xl border px-4 py-3 ${toneClasses(item.tone)}`}>
                <div className="w-20 shrink-0 pt-0.5 font-mono text-xs font-black">{time(item.at)}</div>
                <div className="min-w-0 flex-1"><p className="text-sm font-black">{item.title}</p>{item.detail && <p className="mt-1 break-words text-xs font-semibold opacity-75">{item.detail}</p>}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
