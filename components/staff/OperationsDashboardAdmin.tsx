"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Beer, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardList, PackageCheck, RefreshCcw, ShoppingBasket, Store, TriangleAlert,
} from "lucide-react";
import { formatBarEuro } from "@/lib/barSalesCore";
import { barSalesComparisonColor } from "@/lib/barCashComparison";
import MembershipStatsAdmin from "@/components/staff/MembershipStatsAdmin";
import ScanVisitStatsAdmin from "@/components/staff/ScanVisitStatsAdmin";
import { todayMaltaDate } from "@/lib/maltaDate";
import { nextOperationalOrderActions } from "@/lib/operationalOrdersPresentation";
import type { OperationalOrderStatus, OperationalOrderType } from "@/lib/operationalOrdersCore";

type Gym = { id: string; name: string };
type OrderLine = {
  id: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  unit_price_cents: number | null;
  line_total_cents: number | null;
};
type Order = {
  id: string;
  order_type: OperationalOrderType;
  gym_id: string;
  gym_name: string;
  staff_name: string;
  status: OperationalOrderStatus;
  notes: string | null;
  submitted_at: string;
  business_date: string | null;
  total_cents: number | null;
  cash_found_cents: number | null;
  email_notification_status: string;
  push_notification_status: string;
  items: OrderLine[];
};
type Mode = "all" | OperationalOrderType;
type StatusFilter = "all" | OperationalOrderStatus;
const statuses: StatusFilter[] = ["all", "submitted", "ordered", "completed", "cancelled"];
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta", dateStyle: "medium", timeStyle: "short",
});

function statusClass(status: OperationalOrderStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  if (status === "ordered") return "bg-blue-50 text-blue-700";
  return "bg-orange-50 text-orange-700";
}

export default function OperationsDashboardAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [date, setDate] = useState(() => todayMaltaDate());
  const [mode, setMode] = useState<Mode>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [authResponse, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const auth = await authResponse.json();
        if (cancelled) return;
        const superAdmin = Boolean(authResponse.ok && auth.authenticated && auth.user?.isSuperAdmin);
        setAllowed(superAdmin);
        if (superAdmin && gymsResponse.ok) {
          const gymResponse = await gymsResponse.json();
          if (!cancelled) setGyms((gymResponse.gyms || []) as Gym[]);
        }
      } catch {
        if (!cancelled) setError("Unable to check Super Admin access or load gym locations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const requests = (["sundries", "bar"] as const).map(async (orderType) => {
        const params = new URLSearchParams({ type: orderType });
        if (gymId) params.set("gymId", gymId);
        if (date) params.set("businessDate", date);
        const response = await fetch("/api/system/orders?" + params.toString(), { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load " + orderType + " records.");
        return data.orders as Order[];
      });
      const [sundries, bar] = await Promise.all(requests);
      setTruncated(sundries.length >= 200 || bar.length >= 200);
      setOrders([...sundries, ...bar].sort(
        (a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at),
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load incoming orders.");
    } finally {
      setLoading(false);
    }
  }, [gymId, date]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load, refreshToken]);

  useEffect(() => {
    if (!allowed) return;
    const onFocus = () => { if (document.visibilityState === "visible") setRefreshToken((v) => v + 1); };
    const timer = window.setInterval(onFocus, 45_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [allowed]);

  const filtered = useMemo(() => orders.filter((item) =>
    (mode === "all" || item.order_type === mode) &&
    (status === "all" || item.status === status)
  ), [orders, mode, status]);
  const sundries = orders.filter((item) => item.order_type === "sundries");
  const bars = orders.filter((item) => item.order_type === "bar");
  const awaiting = sundries.filter((item) => item.status === "submitted").length;
  const ordered = sundries.filter((item) => item.status === "ordered").length;
  const barTotal = bars.filter((item) => item.status !== "cancelled")
    .reduce((sum, item) => sum + (item.total_cents ?? 0), 0);
  const undelivered = orders.filter((item) =>
    item.email_notification_status === "failed" || item.push_notification_status === "failed"
  ).length;

  async function changeStatus(order: Order, next: OperationalOrderStatus) {
    if (order.order_type !== "sundries" || savingOrderId ||
        !nextOperationalOrderActions(order.status).includes(next)) return;
    if (next === "cancelled" && !window.confirm("Cancel this Sundries request from " + order.gym_name + "?")) return;
    setSavingOrderId(order.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id, status: next, staffName: "Super Admin",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update this Sundries request.");
      setMessage("Sundries request from " + order.gym_name + " marked " + next + ".");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update the request.");
    } finally {
      setSavingOrderId(null);
    }
  }

  if (allowed === null) return <main className="min-h-screen bg-zinc-50 p-8">Checking Super Admin access…</main>;
  if (!allowed) return <main className="min-h-screen bg-zinc-50 p-8">Super Admin access required. <a href="/staff" className="underline">Staff Home</a></main>;

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href="/staff" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
            <ArrowLeft className="h-4 w-4"/> Staff Home
          </a>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#ff5a0a]">BestGymsMalta · Super Admin</p>
              <h1 className="mt-1 text-3xl font-black">Operations dashboard</h1>
              <p className="mt-1 text-sm text-zinc-600">Sundries requests and submitted Bar Lists from all gym locations.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/staff/bar/catalog" className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">Bar catalogue & prices</a>
              <a href="/staff/bar/reports" className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-800">Bar reports</a>
            </div>
          </div>
        </header>

        <section aria-label="Order filters" className="grid gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="text-sm font-black">Gym
            <select aria-label="Filter operations gym" value={gymId} onChange={(e) => setGymId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900">
              <option value="">All gyms</option>
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-black">Business date (Malta)
            <input aria-label="Filter operations date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900"/>
          </label>
          <label className="text-sm font-black">Record type
            <select aria-label="Filter operations type" value={mode} onChange={(e) => setMode(e.target.value as Mode)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900">
              <option value="all">Sundries + Bar</option>
              <option value="sundries">Sundries only</option>
              <option value="bar">Bar only</option>
            </select>
          </label>
          <label className="text-sm font-black">Status
            <select aria-label="Filter operations status" value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900">
              {statuses.map((value) => <option value={value} key={value}>{value === "all" ? "All statuses" : value.toUpperCase()}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDate("")} className="rounded-xl border border-zinc-200 px-3 py-3 text-sm font-bold">All dates</button>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">
              <RefreshCcw className="h-4 w-4"/> Refresh
            </button>
          </div>
        </section>

        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">{message}</p>}
        {truncated && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          Showing the latest 200 records per category for the selected date/location. Use a narrower filter or Bar reports for historical totals.
        </p>}

        <section aria-label="Operations summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><ClipboardList className="h-7 w-7 text-orange-600"/><p className="mt-2 text-xs font-bold text-zinc-600">Sundries waiting</p><p className="text-3xl font-black tabular-nums">{awaiting}</p></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><PackageCheck className="h-7 w-7 text-blue-600"/><p className="mt-2 text-xs font-bold text-zinc-600">Sundries ordered</p><p className="text-3xl font-black tabular-nums">{ordered}</p></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><Beer className="h-7 w-7 text-orange-600"/><p className="mt-2 text-xs font-bold text-zinc-600">Bar Lists received</p><p className="text-3xl font-black tabular-nums">{bars.length}</p></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><ShoppingBasket className="h-7 w-7 text-emerald-600"/><p className="mt-2 text-xs font-bold text-zinc-600">Bar total (shown)</p><p className="text-2xl font-black tabular-nums">{formatBarEuro(barTotal)}</p></div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4"><TriangleAlert className="h-7 w-7 text-red-600"/><p className="mt-2 text-xs font-bold text-zinc-600">Notification failures</p><p className="text-3xl font-black tabular-nums">{undelivered}</p></div>
        </section>
        <p className="text-xs font-medium text-zinc-500">
          Summary counts and the Bar total reflect the records loaded for the selected date and gym (up to 200 of each type), not an all-time accounting report.
          The Bar total excludes cancelled lists and historical lists without price snapshots.
        </p>

        <MembershipStatsAdmin />
        <ScanVisitStatsAdmin />

        <section aria-label="Incoming requests and sales" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black">Incoming requests and sales</h2>
            <p className="text-sm font-bold text-zinc-500">{loading ? "Loading…" : String(filtered.length) + " records shown"}</p>
          </div>
          {!loading && filtered.length === 0 && (
            <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm font-semibold text-zinc-500">No records match these filters.</p>
          )}
          {filtered.map((order) => {
            const open = Boolean(shown[order.id]);
            return (
              <article key={order.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ff5a0a]">
                      {order.order_type === "sundries" ? <ClipboardList className="h-7 w-7"/> : <Beer className="h-7 w-7"/>}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-orange-700">{order.gym_name || order.gym_id}</p>
                      <h3 className="mt-0.5 text-lg font-black">{order.order_type === "sundries" ? "Sundries request" : "Bar List"} · {order.staff_name}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{timeFormatter.format(new Date(order.submitted_at))} · {order.id}</p>
                      <p className="mt-1 text-xs font-bold text-zinc-500">
                        Email: {order.email_notification_status} · Push: {order.push_notification_status}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={"rounded-full px-3 py-1 text-xs font-black uppercase " + statusClass(order.status)}>{order.status}</span>
                    {order.order_type === "bar" && (
                      <span className={"rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-black tabular-nums " + barSalesComparisonColor(order.total_cents, order.cash_found_cents)}>
                        {order.total_cents === null ? "Historical price unavailable" : formatBarEuro(order.total_cents)}
                      </span>
                    )}
                    <button type="button" aria-label={(open ? "Hide" : "Show") + " details for " + order.id}
                      onClick={() => setShown((current) => ({ ...current, [order.id]: !open }))}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-black">
                      {open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                      {open ? "Hide details" : "View details"}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <div className="divide-y divide-zinc-200 rounded-xl bg-zinc-50 px-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                          <span className="font-bold text-zinc-950">{item.item_name} × {item.quantity}{item.unit ? " " + item.unit : ""}
                            {item.notes && <span className="block text-xs font-medium text-zinc-500">{item.notes}</span>}
                          </span>
                          {order.order_type === "bar" && (
                            <strong className="tabular-nums">{item.unit_price_cents === null
                              ? "Historical price unavailable"
                              : formatBarEuro(item.unit_price_cents) + " each · " + formatBarEuro(item.line_total_cents || 0)}
                            </strong>
                          )}
                        </div>
                      ))}
                    </div>
                    {order.order_type === "bar" && (
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-700">
                        <p><strong>Total Sales:</strong> <span className={"font-black tabular-nums " + barSalesComparisonColor(order.total_cents, order.cash_found_cents)}>{order.total_cents == null ? "Historical price unavailable" : formatBarEuro(order.total_cents)}</span></p>
                        <p><strong>Total Cash Found:</strong> {order.cash_found_cents == null ? "Not recorded" : formatBarEuro(order.cash_found_cents)}</p>
                      </div>
                    )}
                    {order.notes && <p className="mt-3 text-sm text-zinc-700"><strong>Notes:</strong> {order.notes}</p>}
                    {order.order_type === "bar" && order.business_date && (
                      <p className="mt-2 text-xs font-semibold text-zinc-500">Business date: {order.business_date}</p>
                    )}
                    {order.order_type === "sundries" && nextOperationalOrderActions(order.status).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {nextOperationalOrderActions(order.status).map((next) => (
                          <button type="button" key={next} disabled={savingOrderId !== null}
                            onClick={() => void changeStatus(order, next)}
                            className={next === "cancelled"
                              ? "rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 disabled:opacity-50"
                              : "rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"}>
                            {savingOrderId === order.id ? "Saving…" :
                              next === "ordered" ? "Mark ordered" :
                              next === "completed" ? "Mark fulfilled" : "Cancel request"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
        <footer className="rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600">
          <Store className="mr-1 inline h-4 w-4"/> New gyms appear in this dashboard automatically when added to the BGM gym directory.
          Each record retains its original gym, Staff name and submitted item details.
        </footer>
      </div>
    </main>
  );
}
