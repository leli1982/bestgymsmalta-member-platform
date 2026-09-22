"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Minus, Package, Plus, RefreshCcw, Send, ShoppingBasket, Trash2 } from "lucide-react";
import { formatBarEuro, parseEuroCents, sortBarCatalog, type BarCatalogItem } from "@/lib/barSalesCore";

type User = { gymId: string | null; displayName: string; isSuperAdmin: boolean; permissions: string[] };
type Gym = { id: string; name: string; status?: string };
type Extra = { id: number; name: string; quantity: number; price: string };
type DaySummary = { businessDate: string; totalCents: number; submittedCount: number; unpricedCount: number };

const MAX_QTY = 10000;

function QuantityPicker({
  name, quantity, onChange,
}: { name: string; quantity: number; onChange: (number: number) => void }) {
  const next = (value: number) => {
    if (Number.isSafeInteger(value) && value >= 0 && value <= MAX_QTY) onChange(value);
  };
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1">
      <button type="button" aria-label={"Decrease " + name} disabled={quantity === 0}
        onClick={() => next(quantity - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 disabled:opacity-30">
        <Minus className="h-5 w-5"/>
      </button>
      <input aria-label={name + " quantity"} type="number" min="0" max={MAX_QTY} step="1" inputMode="numeric"
        value={quantity} onChange={(event) => next(Number(event.target.value))}
        className="w-14 bg-transparent text-center text-xl font-black text-zinc-950 outline-none"/>
      <button type="button" aria-label={"Increase " + name} disabled={quantity === MAX_QTY}
        onClick={() => next(quantity + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#ff5a0a] disabled:opacity-30">
        <Plus className="h-5 w-5"/>
      </button>
    </div>
  );
}

export default function BarSalesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [catalog, setCatalog] = useState<BarCatalogItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [staffName, setStaffName] = useState("");
  const [notes, setNotes] = useState("");
  const [cashFound, setCashFound] = useState("");
  const [day, setDay] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogChanged, setCatalogChanged] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const nextExtraId = useRef(1);
  const catalogRef = useRef<BarCatalogItem[]>([]);

  const canSubmit = Boolean(user && (user.isSuperAdmin || user.permissions.includes("orders.bar.submit")));
  const gymName = gyms.find((gym) => gym.id === gymId)?.name || gymId || "Select a gym";
  const activeProducts = useMemo(() => sortBarCatalog(catalog.filter((item) => item.active && !item.isOther)), [catalog]);
  const othersItem = catalog.find((item) => item.active && item.isOther);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/system/bar/catalog", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load current Bar prices.");
    const next = sortBarCatalog((payload.items || []) as BarCatalogItem[]);
    const before = catalogRef.current;
    if (before.length &&
      JSON.stringify(before.map((item) => [item.id, item.priceCents, item.name, item.active, item.sortOrder]))
       !== JSON.stringify(next.map((item) => [item.id, item.priceCents, item.name, item.active, item.sortOrder]))) {
      setCatalogChanged(true);
    }
    catalogRef.current = next;
    setCatalog(next);
  }, []);

  const loadDay = useCallback(async (location: string) => {
    if (!location) return;
    const response = await fetch("/api/system/bar/today?gymId=" + encodeURIComponent(location), { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load today's Bar total.");
    setDay(payload as DaySummary);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [authResponse, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const auth = await authResponse.json();
        const gymData = gymsResponse.ok ? await gymsResponse.json() : { gyms: [] };
        if (cancelled) return;
        if (!authResponse.ok || !auth.authenticated || !auth.user) {
          setError("Staff login is required."); return;
        }
        const staff = auth.user as User;
        setUser(staff);
        setStaffName(staff.isSuperAdmin ? "Super Admin" : "");
        const available = (gymData.gyms || []) as Gym[];
        setGyms(available);
        const first = available.find((gym) => gym.status === "active") || available[0];
        const selected = staff.gymId || (staff.isSuperAdmin ? (first?.id || "") : "");
        setGymId(selected);
        await loadCatalog();
        if (selected) await loadDay(selected);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not initialise the Bar list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadCatalog, loadDay]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState !== "visible" || saving) return;
      void loadCatalog().catch(() => setError("Could not refresh current Bar prices. Retry before sending."));
      if (gymId) void loadDay(gymId).catch(() => setError("Could not refresh today's Bar total."));
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const id = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", refresh);
    };
  }, [user, gymId, loadCatalog, loadDay, saving]);

  const selectedItems = useMemo(() => activeProducts
    .filter((item) => (quantities[item.id] || 0) > 0)
    .map((item) => ({
      itemName: item.name,
      quantity: quantities[item.id],
      unitPriceCents: item.priceCents || 0,
      lineTotalCents: (item.priceCents || 0) * quantities[item.id],
      catalogItemId: item.id,
    })), [activeProducts, quantities]);
  const chosenExtras = extras.filter((item) => item.quantity > 0);
  const invalidExtras = chosenExtras.some((item) => !item.name.trim() || parseEuroCents(item.price) === null);
  const draftCents = selectedItems.reduce((sum, item) => sum + item.lineTotalCents, 0)
    + chosenExtras.reduce((sum, item) => sum + item.quantity * (parseEuroCents(item.price) || 0), 0);
  const numberOfLines = selectedItems.length + chosenExtras.length;
  const cashFoundCents = parseEuroCents(cashFound);

  const addExtra = () => setExtras((current) => [
    ...current, { id: nextExtraId.current++, name: "", quantity: 0, price: "" },
  ]);
  const updateExtra = (id: number, patch: Partial<Extra>) => {
    setExtras((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  async function manualRefresh() {
    setRefreshing(true); setError("");
    try {
      await loadCatalog();
      if (gymId) await loadDay(gymId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh the Bar list.");
    } finally {
      setRefreshing(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (catalogChanged) { setError("The Bar catalogue changed. Review the displayed prices, then confirm the update."); return; }
    if (!staffName.trim() || !gymId || numberOfLines === 0 || invalidExtras) {
      setError("Choose your gym, enter Staff name and at least one quantity; complete all Others item names and prices."); return;
    }
    if (cashFoundCents === null) { setError("Count the cash and enter a valid Total Cash Found amount before sending."); return; }
    setSaving(true);
    try {
      const otherEntries = othersItem ? chosenExtras.map((item) => ({
        catalogItemId: othersItem.id, quantity: item.quantity,
        otherName: item.name.trim(), otherPriceCents: parseEuroCents(item.price),
      })) : [];
      const response = await fetch("/api/system/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "bar", gymId: user?.isSuperAdmin ? gymId : undefined,
          staffName: staffName.trim(), notes, cashFoundCents,
          barEntries: [
            ...selectedItems.map((item) => ({
              catalogItemId: item.catalogItemId, quantity: item.quantity,
              expectedPriceCents: item.unitPriceCents,
            })),
            ...otherEntries,
          ],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not submit the Bar list.");
      setQuantities({}); setExtras([]); setNotes(""); setCashFound(""); setCatalogChanged(false);
      setMessage("Bar List saved for " + gymName + " · " +
        formatBarEuro(payload.order?.total_cents || 0) + ". " +
        (payload.emailNotificationStatus === "sent"
          ? "Email sent to Super Admin."
          : "Email was not sent; the list is saved for Super Admin to review."));
      await Promise.all([loadCatalog(), loadDay(gymId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the Bar list.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-zinc-50 p-8">Loading Bar list…</main>;
  if (!user) return <main className="min-h-screen bg-zinc-50 p-8">{error || "Staff login required."} <a href="/staff" className="text-orange-600 underline">Staff Home</a></main>;

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <a href="/staff" className="inline-flex items-center gap-1 text-sm font-bold text-orange-700"><ArrowLeft className="h-4 w-4"/> Staff Home</a>
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-[#ff5a0a]">BGM · Daily bar sales</p>
              <h1 className="text-3xl font-black">Bar List</h1>
              <p className="mt-1 text-sm text-zinc-600">Enter the quantity sold for each item. Prices are maintained by Super Admin.</p>
              <p className="mt-2 text-sm font-black text-orange-700">Location: {gymName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.isSuperAdmin && (
                <a href="/staff/bar/catalog" className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">Manage catalogue & prices</a>
              )}
              {user.isSuperAdmin && (
                <a href="/staff/bar/reports" className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-800">All-gym reports</a>
              )}
              <button type="button" onClick={() => void manualRefresh()} disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-800">
                <RefreshCcw className="h-4 w-4"/> Refresh prices
              </button>
            </div>
          </div>
          {user.isSuperAdmin && (
            <label className="mt-4 block text-sm font-bold">Order location
              <select aria-label="Order location" value={gymId} onChange={(e) => {
                setGymId(e.target.value); setDay(null);
                void loadDay(e.target.value).catch(() => setError("Could not load this gym's daily total."));
              }} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base">
                {gyms.map((gym) => <option value={gym.id} key={gym.id}>{gym.name}</option>)}
              </select>
            </label>
          )}
        </header>
        {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {catalogChanged && (
          <div role="status" className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="font-black text-orange-800">Bar catalogue updated</p>
            <p className="mt-1 text-sm text-orange-700">Review the latest items and prices below. Your entered quantities are preserved.</p>
            <button type="button" onClick={() => setCatalogChanged(false)} className="mt-3 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-black text-white">I have reviewed the new prices</button>
          </div>
        )}

        <form onSubmit={send} className="space-y-5">
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <label className="block max-w-md text-sm font-black">Staff name
              <input aria-label="Bar Staff name" value={staffName} onChange={(e) => setStaffName(e.target.value)}
                placeholder="Enter your name" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950"/>
            </label>
            <div className="mt-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Products & quantities</h2>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-800">{activeProducts.length} active items</span>
            </div>
            {activeProducts.length === 0 && (
              <p className="mt-4 rounded-2xl bg-zinc-50 p-5 text-sm font-bold text-zinc-600">
                No Bar products have been published. Super Admin can add products and prices in the Bar catalogue.
              </p>
            )}
            <div className="mt-4 space-y-2">
              {activeProducts.map((item) => {
                const quantity = quantities[item.id] || 0;
                return (
                  <div key={item.id} className={quantity > 0
                    ? "flex flex-wrap items-center gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-3"
                    : "flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"}>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-[#ff5a0a]"><Package className="h-8 w-8" aria-hidden="true"/></span>
                    <div className="min-w-40 flex-1">
                      <p className="font-black text-zinc-950">{item.name}</p>
                      <p className="text-sm font-bold text-zinc-600">{formatBarEuro(item.priceCents || 0)} per unit</p>
                    </div>
                    <QuantityPicker name={item.name} quantity={quantity}
                      onChange={(value) => setQuantities((prev) => ({ ...prev, [item.id]: value }))}/>
                    <div className="min-w-24 text-right">
                      <p className="text-xs font-bold text-zinc-500">Item total</p>
                      <p className="text-lg font-black tabular-nums text-zinc-950">{formatBarEuro((item.priceCents || 0) * quantity)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {othersItem && (
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Others</h2>
                  <p className="mt-1 text-sm text-zinc-500">For products missing from the official list. Enter their names and unit selling prices.</p>
                </div>
                <button type="button" onClick={addExtra} className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
                  <Plus className="h-5 w-5"/> Add other item
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {extras.map((extra, index) => (
                  <div key={extra.id} className="grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/50 p-3 sm:grid-cols-[minmax(0,2fr)_135px_auto_auto] sm:items-end">
                    <label className="text-sm font-bold">Other item {index + 1}
                      <input aria-label={"Other item " + (index + 1) + " name"} value={extra.name}
                        onChange={(e) => updateExtra(extra.id, { name: e.target.value })} maxLength={120}
                        placeholder="Name of the product" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base"/>
                    </label>
                    <label className="text-sm font-bold">Unit price (€)
                      <input aria-label={"Other item " + (index + 1) + " unit price"} value={extra.price}
                        onChange={(e) => updateExtra(extra.id, { price: e.target.value })} inputMode="decimal"
                        placeholder="0.00" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base"/>
                    </label>
                    <QuantityPicker name={"Other item " + (index + 1)} quantity={extra.quantity}
                      onChange={(value) => updateExtra(extra.id, { quantity: value })}/>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-xs font-bold text-zinc-500">Item total</p>
                      <p className="text-lg font-black tabular-nums">{formatBarEuro((parseEuroCents(extra.price) || 0) * extra.quantity)}</p>
                      <button type="button" aria-label={"Remove other item " + (index + 1)}
                        onClick={() => setExtras((old) => old.filter((item) => item.id !== extra.id))}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-700"><Trash2 className="h-4 w-4"/> Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-orange-700">Total Sales</p>
                <p className="mt-2 text-3xl font-black tabular-nums" aria-label="Total Sales calculated">{formatBarEuro(draftCents)}</p>
                <p className="mt-1 text-xs text-zinc-600">Calculated automatically from this list's quantities and published prices.</p>
              </div>
              <label className="block rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-black">
                Total Cash Found (€)
                <input aria-label="Total Cash Found" required value={cashFound}
                  onChange={(event) => setCashFound(event.target.value)}
                  inputMode="decimal" placeholder="0.00"
                  className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-lg text-zinc-950" />
                <span className="mt-1 block text-xs font-medium text-zinc-600">Enter the cash counted at the end of the shift. Enter 0.00 if none.</span>
              </label>
            </div>
            <label className="text-sm font-black">Notes (optional)
              <textarea aria-label="Bar List notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={3} maxLength={1000} placeholder="Anything Super Admin should know?"
                className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base"/>
            </label>
            <div className="mt-5 space-y-2 rounded-2xl bg-zinc-950 p-5 text-white">
              <div className="flex justify-between gap-3 text-sm"><span>Submitted today · {gymName}</span><strong>{day ? formatBarEuro(day.totalCents) : "—"}</strong></div>
              <div className="flex justify-between gap-3 text-sm"><span>Total Sales · current list ({numberOfLines} items)</span><strong>{formatBarEuro(draftCents)}</strong></div>
              <div className="border-t border-zinc-700 pt-3 flex flex-wrap justify-between gap-3 text-xl font-black">
                <span>BAR TOTAL FOR THE DAY</span>
                <span className="tabular-nums text-orange-400">{day ? formatBarEuro(day.totalCents + draftCents) : "—"}</span>
              </div>
              <p className="text-xs text-zinc-400">Includes earlier submitted lists from this gym today, plus the current unsent list. Cancelled lists are excluded.</p>
              {day && <p className="text-xs text-zinc-400">{day.businessDate} · {day.submittedCount} lists submitted</p>}
            </div>
            <button type="submit" disabled={!canSubmit || saving || !gymId || !day || !numberOfLines || invalidExtras || catalogChanged || cashFoundCents === null}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#ff5a0a] px-5 py-4 text-lg font-black text-white disabled:opacity-40">
              <Send className="h-6 w-6"/> {saving ? "SENDING BAR LIST…" : "SEND BAR LIST"}
            </button>
            <p className="mt-2 text-center text-xs font-bold text-zinc-500">The list is saved for Super Admin and emailed according to notification settings.</p>
          </section>
        </form>
      </div>
    </main>
  );
}
