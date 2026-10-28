"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Minus, Package, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { filterBarProducts, formatBarEuro, parseEuroCents, sortBarCatalog, type BarCatalogItem } from "@/lib/barSalesCore";

type User = { gymId: string | null; displayName: string; isSuperAdmin: boolean; permissions: string[] };
type Gym = { id: string; name: string; status?: string };
type Extra = { id: number; name: string; quantity: number; price: string };
type DailySheetItem = {
  id?: string;
  catalogItemId: string;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};
type DailySheet = {
  gymId: string;
  businessDate: string;
  orderId: string | null;
  totalCents: number;
  locked: boolean;
  lockedAt: string | null;
  updatedAt: string | null;
  items: DailySheetItem[];
};
type SaveState = "idle" | "saving" | "saved" | "offline";

const MAX_QTY = 10000;

function QuantityPicker({ name, quantity, locked, onChange }: {
  name: string;
  quantity: number;
  locked: boolean;
  onChange: (quantity: number) => void;
}) {
  const next = (value: number) => {
    if (!locked && Number.isSafeInteger(value) && value >= 0 && value <= MAX_QTY) onChange(value);
  };
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1">
      <button type="button" aria-label={`Decrease ${name}`} disabled={locked || quantity === 0}
        onClick={() => next(quantity - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 disabled:opacity-30">
        <Minus className="h-5 w-5" />
      </button>
      <input aria-label={`${name} quantity`} type="number" min="0" max={MAX_QTY} step="1" inputMode="numeric"
        disabled={locked} value={quantity} onChange={(event) => next(Number(event.target.value))}
        className="w-14 bg-transparent text-center text-xl font-black text-zinc-950 outline-none disabled:opacity-50" />
      <button type="button" aria-label={`Increase ${name}`} disabled={locked || quantity === MAX_QTY}
        onClick={() => next(quantity + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#ff5a0a] disabled:opacity-30">
        <Plus className="h-5 w-5" />
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
  const [productFilter, setProductFilter] = useState("");
  const [sheet, setSheet] = useState<DailySheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [dirtyToken, setDirtyToken] = useState(0);
  const nextExtraId = useRef(1);
  const pendingKeyRef = useRef("");

  const activeProducts = useMemo(() => sortBarCatalog(catalog.filter((item) => item.active && !item.isOther)), [catalog]);
  const visibleProducts = useMemo(() => filterBarProducts(activeProducts, productFilter), [activeProducts, productFilter]);
  const othersItem = catalog.find((item) => item.active && item.isOther);
  const gymName = gyms.find((gym) => gym.id === gymId)?.name || gymId || "Gym";
  const locked = Boolean(sheet?.locked);

  const selectedItems = useMemo(() => activeProducts
    .filter((item) => (quantities[item.id] || 0) > 0)
    .map((item) => ({
      catalogItemId: item.id,
      quantity: quantities[item.id],
      expectedPriceCents: item.priceCents,
      lineTotalCents: (item.priceCents || 0) * quantities[item.id],
    })), [activeProducts, quantities]);
  const chosenExtras = extras.filter((item) => item.quantity > 0);
  const invalidExtras = chosenExtras.some((item) => !item.name.trim() || parseEuroCents(item.price) === null);
  const totalCents = selectedItems.reduce((sum, item) => sum + item.lineTotalCents, 0)
    + chosenExtras.reduce((sum, item) => sum + item.quantity * (parseEuroCents(item.price) || 0), 0);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/system/bar/catalog", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load current Bar prices.");
    setCatalog(sortBarCatalog((payload.items || []) as BarCatalogItem[]));
  }, []);

  const applySheet = useCallback((next: DailySheet, currentCatalog: BarCatalogItem[]) => {
    const nextQuantities: Record<string, number> = {};
    const nextExtras: Extra[] = [];
    const otherIds = new Set(currentCatalog.filter((item) => item.isOther).map((item) => item.id));
    for (const row of next.items || []) {
      if (otherIds.has(row.catalogItemId)) {
        nextExtras.push({
          id: nextExtraId.current++,
          name: row.itemName,
          quantity: Number(row.quantity || 0),
          price: (Number(row.unitPriceCents || 0) / 100).toFixed(2),
        });
      } else {
        nextQuantities[row.catalogItemId] = Number(row.quantity || 0);
      }
    }
    setQuantities(nextQuantities);
    setExtras(nextExtras);
    setSheet(next);
    pendingKeyRef.current = `bgm-bar-pending:${next.gymId}:${next.businessDate}`;
  }, []);

  const loadSheet = useCallback(async (location: string, currentCatalog: BarCatalogItem[]) => {
    const response = await fetch(`/api/system/bar/today?gymId=${encodeURIComponent(location)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load today's Bar sheet.");
    applySheet(payload as DailySheet, currentCatalog);
    setSaveState("saved");
  }, [applySheet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [authResponse, gymsResponse, catalogResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
          fetch("/api/system/bar/catalog", { cache: "no-store" }),
        ]);
        const auth = await authResponse.json();
        const gymData = gymsResponse.ok ? await gymsResponse.json() : { gyms: [] };
        const catalogData = await catalogResponse.json();
        if (cancelled) return;
        if (!authResponse.ok || !auth.authenticated || !auth.user) throw new Error("Staff login is required.");
        if (!catalogResponse.ok) throw new Error(catalogData.error || "Could not load Bar prices.");
        const staff = auth.user as User;
        const available = (gymData.gyms || []) as Gym[];
        const currentCatalog = sortBarCatalog((catalogData.items || []) as BarCatalogItem[]);
        const first = available.find((gym) => gym.status === "active") || available[0];
        const selected = staff.gymId || (staff.isSuperAdmin ? (first?.id || "") : "");
        setUser(staff);
        setGyms(available);
        setCatalog(currentCatalog);
        setGymId(selected);
        if (!selected) throw new Error("This account is not assigned to a gym.");
        await loadSheet(selected, currentCatalog);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not initialise the Bar sheet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadSheet]);

  const buildEntries = useCallback(() => {
    if (invalidExtras || !othersItem) {
      if (chosenExtras.length) return null;
    }
    return [
      ...selectedItems.map((item) => ({
        catalogItemId: item.catalogItemId,
        quantity: item.quantity,
        expectedPriceCents: item.expectedPriceCents,
      })),
      ...(othersItem ? chosenExtras.map((item) => ({
        catalogItemId: othersItem.id,
        quantity: item.quantity,
        otherName: item.name.trim(),
        otherPriceCents: parseEuroCents(item.price),
      })) : []),
    ];
  }, [chosenExtras, invalidExtras, othersItem, selectedItems]);

  const saveNow = useCallback(async () => {
    if (!user || !gymId || locked) return;
    const barEntries = buildEntries();
    if (!barEntries) {
      setSaveState("idle");
      return;
    }
    const payload = { gymId: user.isSuperAdmin ? gymId : undefined, barEntries };
    setSaveState("saving");
    setError("");
    try {
      const response = await fetch("/api/system/bar/today", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.locked) {
          setSheet((current) => current ? { ...current, locked: true } : current);
          throw new Error("End of Day has been submitted. This Bar sheet is now locked.");
        }
        throw new Error(data.error || "Could not save today's Bar sheet.");
      }
      if (pendingKeyRef.current) window.localStorage.removeItem(pendingKeyRef.current);
      if (data.sheet) setSheet(data.sheet as DailySheet);
      setSaveState("saved");
    } catch (saveError) {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online) {
        if (pendingKeyRef.current) window.localStorage.setItem(pendingKeyRef.current, JSON.stringify(payload));
        setSaveState("offline");
      } else {
        setSaveState("idle");
        setError(saveError instanceof Error ? saveError.message : "Could not save today's Bar sheet.");
      }
    }
  }, [buildEntries, gymId, locked, user]);

  useEffect(() => {
    if (!dirtyToken || loading || locked) return;
    const timer = window.setTimeout(() => void saveNow(), 350);
    return () => window.clearTimeout(timer);
  }, [dirtyToken, loading, locked, saveNow]);

  useEffect(() => {
    const retry = () => {
      if (saveState === "offline" && !locked) void saveNow();
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [locked, saveNow, saveState]);

  const markQuantity = (itemId: string, value: number) => {
    setQuantities((current) => ({ ...current, [itemId]: value }));
    setDirtyToken((value) => value + 1);
  };
  const addExtra = () => {
    setExtras((current) => [...current, { id: nextExtraId.current++, name: "", quantity: 0, price: "" }]);
  };
  const updateExtra = (id: number, patch: Partial<Extra>) => {
    setExtras((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setDirtyToken((value) => value + 1);
  };
  const removeExtra = (id: number) => {
    setExtras((current) => current.filter((item) => item.id !== id));
    setDirtyToken((value) => value + 1);
  };

  async function manualRefresh() {
    if (!gymId) return;
    setRefreshing(true);
    setError("");
    try {
      await loadCatalog();
      const response = await fetch("/api/system/bar/catalog", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh Bar prices.");
      const currentCatalog = sortBarCatalog((data.items || []) as BarCatalogItem[]);
      setCatalog(currentCatalog);
      await loadSheet(gymId, currentCatalog);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not refresh the Bar sheet.");
    } finally {
      setRefreshing(false);
    }
  }

  async function changeGym(nextGymId: string) {
    if (!user?.isSuperAdmin) return;
    setGymId(nextGymId);
    setSheet(null);
    setQuantities({});
    setExtras([]);
    setError("");
    await loadSheet(nextGymId, catalog).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load this Bar sheet."));
  }

  if (loading) return <main className="min-h-screen bg-zinc-50 p-8">Loading Bar sheet…</main>;
  if (!user) return <main className="min-h-screen bg-zinc-50 p-8">{error || "Staff login required."}</main>;

  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline – waiting to sync" : "Saved";

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <a href="/staff" className="inline-flex items-center gap-1 text-sm font-bold text-orange-700"><ArrowLeft className="h-4 w-4" /> Staff Home</a>
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-[#ff5a0a]">BGM · Live daily bar sheet</p>
              <h1 className="text-3xl font-black">Bar</h1>
              <p className="mt-1 text-sm text-zinc-600">Press + or − as items are sold. Changes save automatically.</p>
              <p className="mt-2 text-sm font-black text-orange-700">Location: {gymName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span role="status" className={`rounded-full px-3 py-2 text-xs font-black ${saveState === "offline" ? "bg-amber-100 text-amber-800" : saveState === "saving" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{saveLabel}</span>
              {user.isSuperAdmin && <a href="/staff/bar/catalog" className="inline-flex items-center gap-2 rounded-xl bg-[#ff5a0a] px-4 py-3 text-sm font-black text-white"><ClipboardList className="h-4 w-4" /> Edit Bar List</a>}
              <button type="button" onClick={() => void manualRefresh()} disabled={refreshing || saveState === "saving"}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold"><RefreshCcw className="h-4 w-4" /> Refresh</button>
            </div>
          </div>
          {user.isSuperAdmin && (
            <label className="mt-4 block text-sm font-bold">Bar location
              <select aria-label="Bar location" value={gymId} onChange={(event) => void changeGym(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base">
                {gyms.map((gym) => <option value={gym.id} key={gym.id}>{gym.name}</option>)}
              </select>
            </label>
          )}
        </header>

        {locked && (
          <div role="status" className="rounded-2xl border border-zinc-300 bg-zinc-100 p-4 text-sm font-black text-zinc-800">
            End of Day submitted — this Bar sheet is locked.
          </div>
        )}
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-black">Find product
            <input aria-label="Find Bar product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}
              placeholder="Start typing a product name…" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base" />
          </label>
          <div className="mt-4 space-y-3">
            {visibleProducts.map((item) => {
              const quantity = quantities[item.id] || 0;
              return (
                <div key={item.id} className={quantity > 0 ? "flex flex-wrap items-center gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-3" : "flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3"}>
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-[#ff5a0a]"><Package className="h-8 w-8" /></span>
                  <div className="min-w-40 flex-1"><p className="font-black">{item.name}</p><p className="text-sm font-bold text-zinc-600">{formatBarEuro(item.priceCents || 0)} per unit</p></div>
                  <QuantityPicker name={item.name} quantity={quantity} locked={locked} onChange={(value) => markQuantity(item.id, value)} />
                  <div className="min-w-24 text-right"><p className="text-xs font-bold text-zinc-500">Item total</p><p className="text-lg font-black tabular-nums">{formatBarEuro((item.priceCents || 0) * quantity)}</p></div>
                </div>
              );
            })}
          </div>
        </section>

        {othersItem && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-black">Others</h2><p className="mt-1 text-sm text-zinc-500">Use only for a product missing from the official list.</p></div>
              <button type="button" onClick={addExtra} disabled={locked} className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700 disabled:opacity-40"><Plus className="h-5 w-5" /> Add other item</button>
            </div>
            <div className="mt-4 space-y-3">
              {extras.map((extra, index) => (
                <div key={extra.id} className="grid gap-3 rounded-2xl border border-orange-200 bg-orange-50/50 p-3 sm:grid-cols-[minmax(0,2fr)_135px_auto_auto] sm:items-end">
                  <label className="text-sm font-bold">Other item {index + 1}
                    <input aria-label={`Other item ${index + 1} name`} disabled={locked} value={extra.name} onChange={(event) => updateExtra(extra.id, { name: event.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base disabled:opacity-50" />
                  </label>
                  <label className="text-sm font-bold">Unit price (€)
                    <input aria-label={`Other item ${index + 1} unit price`} disabled={locked} value={extra.price} onChange={(event) => updateExtra(extra.id, { price: event.target.value })} inputMode="decimal" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base disabled:opacity-50" />
                  </label>
                  <QuantityPicker name={`Other item ${index + 1}`} quantity={extra.quantity} locked={locked} onChange={(value) => updateExtra(extra.id, { quantity: value })} />
                  <div className="flex flex-col items-end gap-1"><p className="text-xs font-bold text-zinc-500">Item total</p><p className="text-lg font-black tabular-nums">{formatBarEuro((parseEuroCents(extra.price) || 0) * extra.quantity)}</p>
                    <button type="button" disabled={locked} onClick={() => removeExtra(extra.id)} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 disabled:opacity-40"><Trash2 className="h-4 w-4" /> Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {invalidExtras && <p className="mt-3 text-sm font-bold text-amber-700">Complete the name and price for each Other item before it can save.</p>}
          </section>
        )}

        <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-orange-400">Bar total for today</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3"><span className="text-sm text-zinc-300">{sheet?.businessDate || "Today"} · {gymName}</span><strong aria-label="Bar total for today" className="text-4xl font-black tabular-nums text-orange-400">{formatBarEuro(totalCents)}</strong></div>
          <p className="mt-3 text-xs text-zinc-400">There is no Send Bar List button. This is the one live daily sheet for this gym and it feeds End of Day automatically.</p>
        </section>
      </div>
    </main>
  );
}
