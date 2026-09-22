"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, RefreshCcw } from "lucide-react";
import { formatBarEuro } from "@/lib/barSalesCore";
import { todayMaltaDate } from "@/lib/maltaDate";

type Gym = { id: string; name: string };
type Line = {
  id: string;
  item_name: string;
  quantity: number;
  unit_price_cents: number | null;
  line_total_cents: number | null;
  notes: string | null;
};
type Report = {
  id: string;
  gym_id: string;
  gym_name: string;
  staff_name: string;
  status: string;
  business_date: string | null;
  submitted_at: string;
  total_cents: number | null;
  cash_found_cents: number | null;
  notes: string | null;
  email_notification_status: string;
  push_notification_status: string;
  items: Line[];
};

export default function BarReportsAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [date, setDate] = useState(() => todayMaltaDate());
  const [orders, setOrders] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ type: "bar" });
      if (gymId) params.set("gymId", gymId);
      if (date) params.set("businessDate", date);
      const response = await fetch("/api/system/orders?" + params.toString(), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load Bar reports.");
      setOrders(payload.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Bar reports.");
    } finally {
      setLoading(false);
    }
  }, [gymId, date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [auth, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const p = await auth.json();
        if (cancelled) return;
        const superAdmin = Boolean(p.authenticated && p.user?.isSuperAdmin);
        setAllowed(superAdmin);
        if (superAdmin && gymsResponse.ok) setGyms((await gymsResponse.json()).gyms || []);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (allowed === null) return <main className="p-8">Checking Super Admin access…</main>;
  if (!allowed) return <main className="p-8">Super Admin access required. <a href="/staff" className="underline">Staff Home</a></main>;

  const totalCents = orders.filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + (order.total_cents || 0), 0);
  const unpriced = orders.filter((order) => order.total_cents == null);

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5">
          <a href="/staff/bar" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700">
            <ArrowLeft className="h-4 w-4"/> Back to Bar
          </a>
          <h1 className="mt-3 text-3xl font-black">Bar List · Super Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">View submitted sales by gym and Malta business date. Every line retains its original selling price.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
            <label className="text-sm font-bold">Location
              <select aria-label="Bar report gym" value={gymId} onChange={(e) => setGymId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3">
                <option value="">All gyms</option>
                {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">Business date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Bar report date"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"/>
            </label>
            <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 font-bold text-white"><RefreshCcw className="h-4 w-4"/> Refresh</button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Clear the date to browse recent lists across multiple days (up to 200 latest records).</p>
        </header>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-bold text-zinc-500">Visible Bar total</p>
            <p className="mt-1 text-3xl font-black tabular-nums">{formatBarEuro(totalCents)}</p>
            <p className="mt-1 text-xs text-zinc-500">Excludes cancelled lists. Current filter: {date || "recent records"}.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-bold text-zinc-500">Lists shown</p>
            <p className="mt-1 text-3xl font-black">{orders.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-bold text-zinc-500">Legacy lists without price snapshots</p>
            <p className="mt-1 text-3xl font-black">{unpriced.length}</p>
          </div>
        </section>
        {loading ? <p className="rounded-xl bg-white p-5">Loading reports…</p> :
          orders.length === 0 ? <p className="rounded-xl bg-white p-5 text-zinc-500">No Bar Lists match the selected date and location.</p> : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article key={order.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-orange-700">{order.gym_name}</p>
                      <h2 className="mt-1 text-xl font-black">{order.business_date || "Historical Bar List"} · {order.staff_name}</h2>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">{new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/Malta", dateStyle: "medium", timeStyle: "short",
                      }).format(new Date(order.submitted_at))} · {order.id}</p>
                      <p className="mt-1 text-xs text-zinc-500">Status: {order.status} · Email: {order.email_notification_status} · Push: {order.push_notification_status}</p>
                    </div>
                    <p className="text-2xl font-black tabular-nums text-zinc-950">
                      {order.total_cents == null ? "Price unavailable" : formatBarEuro(order.total_cents)}
                    </p>
                  </div>
                  <div className="mt-4 divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <span className="font-bold">{item.item_name} × {item.quantity}</span>
                        <span className="tabular-nums font-bold">{item.unit_price_cents == null ? "Historical price unavailable"
                          : formatBarEuro(item.unit_price_cents) + " each · " + formatBarEuro(item.line_total_cents || 0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                    <p><strong>Total Sales:</strong> {order.total_cents == null ? "Historical price unavailable" : formatBarEuro(order.total_cents)}</p>
                    <p><strong>Total Cash Found:</strong> {order.cash_found_cents == null ? "Not recorded" : formatBarEuro(order.cash_found_cents)}</p>
                  </div>
                  {order.notes && <p className="mt-3 text-sm text-zinc-700"><ClipboardList className="mr-1 inline h-4 w-4"/> Notes: {order.notes}</p>}
                </article>
              ))}
            </div>
          )}
      </div>
    </main>
  );
}
