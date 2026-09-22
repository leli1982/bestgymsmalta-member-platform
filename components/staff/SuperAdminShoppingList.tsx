"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, PackageCheck, RefreshCw, ShoppingBasket } from "lucide-react";
import { buildShoppingList, type ShoppingListOrder, type ShoppingListLine, type ShoppingListTotal } from "@/lib/shoppingListCore";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta", dateStyle: "medium", timeStyle: "short",
});
const quantityFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
function lineLabel(line: Pick<ShoppingListLine, "item_name" | "quantity" | "unit">) {
  return quantityFormatter.format(Number(line.quantity)) + " × " + line.item_name + (line.unit ? " (" + line.unit + ")" : "");
}
function totalLabel(item: ShoppingListTotal) {
  return quantityFormatter.format(item.quantity) + " × " + item.name + (item.unit ? " (" + item.unit + ")" : "");
}

export default function SuperAdminShoppingList() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<ShoppingListOrder[]>([]);
  const [delivered, setDelivered] = useState<ShoppingListOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/system/shopping-list", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load outstanding Sundries requests.");
      setOrders((data.orders || []) as ShoppingListOrder[]);
      setLastUpdated(new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Malta", hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date()));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load the Shopping List.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        const authorised = response.ok && data.authenticated && Boolean(data.user?.isSuperAdmin);
        setAllowed(authorised);
        if (authorised) await load();
        else setLoading(false);
      } catch {
        if (active) { setAllowed(false); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (!allowed) return;
    const onFocus = () => { if (document.visibilityState === "visible" && !savingId) void load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [allowed, load, savingId]);

  const shopping = useMemo(() => buildShoppingList(orders), [orders]);

  async function markDelivered(order: ShoppingListOrder) {
    if (savingId || !window.confirm(
      "Mark the Sundries request from " + order.gym_name + " as DELIVERED? It will be removed from the outstanding shopping totals."
    )) return;
    setSavingId(order.id);
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/shopping-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not mark the request delivered.");
      // Recompute the list only after the server commits, never when merely clicked.
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: "completed" } : item));
      setDelivered((current) => [order, ...current.filter((item) => item.id !== order.id)]);
      setMessage("Delivered: " + order.gym_name + ". Its items were removed from the outstanding shopping totals.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not mark the request delivered. Refresh and try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (allowed === null) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950">Checking Super Admin access…</main>;
  if (!allowed) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-950">Super Admin access required. <a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700"><ArrowLeft className="h-4 w-4"/> Super Admin</a>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white"><ShoppingBasket className="h-7 w-7"/></span>
              <div>
                <h1 className="text-3xl font-black">Shopping List</h1>
                <p className="mt-1 text-sm text-zinc-600">Combined outstanding Sundries requests and delivery lists for each gym.</p>
              </div>
            </div>
            <button type="button" onClick={() => void load()} disabled={refreshing || Boolean(savingId)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-40">
              <RefreshCw className="h-4 w-4"/> {refreshing ? "Refreshing…" : "Refresh list"}
            </button>
          </div>
          <p className="mt-3 text-xs font-medium text-zinc-500">
            Includes all Submitted and Ordered Sundries requests, including earlier dates. Delivered (Completed), Cancelled and Bar records are not added to the shopping totals.
            {lastUpdated ? " Last updated at " + lastUpdated + " Malta time." : ""}
          </p>
        </header>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{message}</p>}
        {loading ? <p className="rounded-2xl bg-white p-6 text-zinc-600">Loading outstanding requests…</p> : (
          <>
            <section aria-label="Combined shopping totals" className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-black"><ShoppingBasket className="h-6 w-6 text-orange-600"/> Total items to buy</h2>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">{shopping.openOrderCount} outstanding {shopping.openOrderCount === 1 ? "request" : "requests"}</span>
              </div>
              {shopping.totals.length ? (
                <ul className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Shopping totals">
                  {shopping.totals.map((item) => <li key={item.name.toLocaleLowerCase("en") + "|" + (item.unit || "").toLocaleLowerCase("en")} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base font-black tabular-nums">{totalLabel(item)}</li>)}
                </ul>
              ) : <p className="mt-4 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">No outstanding Sundries items to buy.</p>}
            </section>

            <section aria-label="Deliveries by gym" className="space-y-4">
              <h2 className="text-2xl font-black">Deliveries by gym</h2>
              {shopping.gyms.length === 0 ? <p className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-600">There are no pending gym deliveries.</p> :
                shopping.gyms.map((gym) => (
                  <article key={gym.gymId} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
                    <div className="border-b border-zinc-200 bg-orange-50 px-5 py-4">
                      <h3 className="text-xl font-black">{gym.gymName}</h3>
                      <p className="mt-1 text-xs font-bold text-zinc-600">{gym.orders.length} outstanding {gym.orders.length === 1 ? "request" : "requests"} · Delivery location</p>
                      <ul aria-label={"Items for " + gym.gymName} className="mt-3 grid gap-2 sm:grid-cols-2">
                        {buildShoppingList(gym.orders).totals.map((item) => <li key={item.name.toLocaleLowerCase("en") + "|" + (item.unit || "").toLocaleLowerCase("en")} className="rounded-lg bg-white px-3 py-2 text-sm font-black tabular-nums">{totalLabel(item)}</li>)}
                      </ul>
                    </div>
                    <div className="space-y-3 p-4 sm:p-5">
                      {gym.orders.map((order) => (
                        <section key={order.id} aria-label={"Sundries request " + order.id} className="rounded-2xl border border-zinc-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-black">Request by {order.staff_name}</p>
                              <p className="mt-1 text-xs font-semibold text-zinc-500">{timeFormatter.format(new Date(order.submitted_at))} · {order.status === "ordered" ? "ORDERED" : "SUBMITTED"} · #{order.id.slice(0, 8)}</p>
                            </div>
                            <button type="button" disabled={Boolean(savingId)}
                              onClick={() => void markDelivered(order)}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40">
                              <PackageCheck className="h-4 w-4"/>{savingId === order.id ? "Saving…" : "Delivered"}
                            </button>
                          </div>
                          <ul className="mt-3 space-y-1" aria-label={"Items in request " + order.id}>
                            {order.items.map((item, index) => <li key={item.id || String(index)} className="text-sm font-semibold text-zinc-950">{lineLabel(item)}{item.notes ? <span className="text-zinc-600"> · {item.notes}</span> : null}</li>)}
                          </ul>
                          {order.notes && <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700"><strong>Request notes:</strong> {order.notes}</p>}
                        </section>
                      ))}
                    </div>
                  </article>
                ))}
            </section>
            {delivered.length > 0 && <section aria-label="Delivered during this session" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-emerald-800"><CheckCircle2 className="h-5 w-5"/> Delivered during this session</h2>
              <p className="mt-1 text-xs text-emerald-800">These requests have been marked Completed and remain in Operations history.</p>
              {delivered.map((order) => <p key={order.id} className="mt-2 rounded-lg bg-white p-3 text-sm font-bold">{order.gym_name} · {order.items.map((item) => lineLabel(item)).join(", ")} <span className="font-black text-emerald-700">· DELIVERED</span></p>)}
            </section>}
            <p className="flex items-center gap-2 text-xs text-zinc-500"><ClipboardCheck className="h-4 w-4"/> Delivery is recorded per request, not per individual product. Only mark an entire request Delivered once all its items reach the gym.</p>
          </>
        )}
      </div>
    </main>
  );
}
