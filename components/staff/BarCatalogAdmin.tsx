"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, Save } from "lucide-react";
import { parseEuroCents, type BarCatalogItem } from "@/lib/barSalesCore";

type Edit = { name: string; price: string; sortOrder: number; active: boolean };
type StarterItem = { name: string; priceCents: number; sortOrder: number };
const editable = (item: BarCatalogItem): Edit => ({
  name: item.name,
  price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
  sortOrder: item.sortOrder,
  active: item.active,
});

export default function BarCatalogAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<BarCatalogItem[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [starter, setStarter] = useState<StarterItem[] | null>(null);
  const [starterNotes, setStarterNotes] = useState<string[]>([]);
  const [loadingStarter, setLoadingStarter] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/system/bar/catalog", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load the Bar catalogue.");
    const items = (payload.items || []) as BarCatalogItem[];
    setCatalog(items);
    setEdits(Object.fromEntries(items.map((item) => [item.id, editable(item)])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/system/auth", { cache: "no-store" });
        const p = await r.json();
        if (cancelled) return;
        const authorized = Boolean(p.authenticated && p.user?.isSuperAdmin);
        setAllowed(authorized);
        if (authorized) await load();
      } catch {
        if (!cancelled) setError("Could not verify Super Admin access or load products.");
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  async function write(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setSaving(true);
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/bar/catalog", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save this item.");
      await load();
      setMessage("Bar catalogue updated. Staff will receive the new list and prices.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this item.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function previewStarter() {
    setLoadingStarter(true);
    setError("");
    try {
      const response = await fetch("/api/system/bar/catalog?starter=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the starter sheet.");
      setStarter(data.items || []);
      setStarterNotes(data.reviewNotes || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the starter sheet.");
    } finally {
      setLoadingStarter(false);
    }
  }

  async function publishStarter() {
    const ok = await write("POST", {
      starterImport: true, confirmation: "PUBLISH_STARTER_BAR_CATALOG",
    });
    if (ok) setStarter(null);
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const cents = parseEuroCents(price);
    if (!name.trim() || cents === null) { setError("Enter an item name and valid euro price (e.g. 2.50)."); return; }
    const ok = await write("POST", {
      name: name.trim(), priceCents: cents,
      sortOrder: Math.max(0, ...catalog.map((item) => item.sortOrder)) + 10,
    });
    if (ok) { setName(""); setPrice(""); }
  }

  async function save(item: BarCatalogItem) {
    const edit = edits[item.id];
    if (!edit) return;
    const cents = item.isOther ? null : parseEuroCents(edit.price);
    if (!item.isOther && cents === null) { setError("Enter a valid euro price for " + item.name); return; }
    await write("PATCH", {
      id: item.id, name: item.isOther ? "Others" : edit.name.trim(),
      priceCents: cents, sortOrder: edit.sortOrder, active: edit.active,
    });
  }

  if (allowed === null) return <main className="min-h-screen bg-zinc-50 p-8">Checking Super Admin access…</main>;
  if (!allowed) return <main className="min-h-screen bg-zinc-50 p-8">Super Admin access required. <a href="/staff" className="underline">Staff Home</a></main>;

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href="/staff/bar" className="inline-flex items-center gap-2 text-sm font-bold text-orange-700"><ArrowLeft className="h-4 w-4"/> Back to Bar</a>
          <h1 className="mt-3 text-3xl font-black">Bar catalogue & prices</h1>
          <p className="mt-1 text-sm text-zinc-500">Super Admin manages the live Staff list. Previously submitted Bar Lists keep their original prices.</p>
        </header>
        {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</p>}
        {catalog.length === 0 && (
          <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
            <h2 className="text-xl font-black">Import your Bar Sales sheet</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Review all printed products and prices first. Nothing becomes visible to Staff until you publish.
              Import is available only while this catalogue is empty; it never overwrites existing products.
            </p>
            <button type="button" onClick={() => void previewStarter()} disabled={saving || loadingStarter}
              className="mt-3 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
              {loadingStarter ? "Loading sheet…" : starter ? "Reload sheet preview" : "Review starter sheet"}
            </button>
            {starter && (
              <div className="mt-4 space-y-3" aria-label="Starter Bar Sales sheet preview">
                <p className="text-sm font-black">{starter.length} products + Others (no preset price)</p>
                <div className="rounded-xl border border-orange-200 bg-white p-3 text-sm text-zinc-700">
                  {starterNotes.map((note) => <p key={note} className="mb-1 last:mb-0">{note}</p>)}
                </div>
                <div className="max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-zinc-950 text-white">
                      <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Unit price</th></tr>
                    </thead>
                    <tbody>
                      {starter.map((item) => (
                        <tr key={item.name} className="border-t border-zinc-100">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">€{(item.priceCents / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" disabled={saving} onClick={() => void publishStarter()}
                  className="rounded-xl bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                  Publish {starter.length} products + Others to Staff
                </button>
              </div>
            )}
          </section>
        )}
        <form onSubmit={add} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Add Bar item</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
            <label className="text-sm font-bold">Product name
              <input aria-label="New Bar product name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
                placeholder="e.g. Still water 500 ml" className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-3 text-base"/>
            </label>
            <label className="text-sm font-bold">Unit price (€)
              <input aria-label="New Bar unit price" value={price} onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal" placeholder="2.50" className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-3 text-base"/>
            </label>
            <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5a0a] px-5 py-3 font-black text-white disabled:opacity-50"><Plus className="h-5 w-5"/> Add product</button>
          </div>
          {!catalog.some((item) => item.isOther) && (
            <button type="button" disabled={saving} onClick={() => void write("POST", { isOther: true, sortOrder: 9999 })}
              className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
              + Add Others (Staff enter the item name and selling price)
            </button>
          )}
        </form>
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-black">Published products</h2><p className="mt-1 text-sm text-zinc-500">Edit a price, change display order or hide an item from Staff.</p></div>
            <button onClick={() => void load().catch((e) => setError(String(e)))} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4"/> Refresh</button>
          </div>
          {catalog.length === 0 ? <p className="mt-4 rounded-xl bg-zinc-50 p-4">No products yet. Add your first item above.</p> : (
            <div className="mt-4 space-y-3">
              {catalog.map((item) => {
                const edit = edits[item.id];
                if (!edit) return null;
                return (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-zinc-200 p-3 sm:grid-cols-[minmax(0,2fr)_140px_95px_auto_auto] sm:items-end">
                    <label className="text-xs font-bold text-zinc-600">Product
                      <input aria-label={item.name + " name"} value={edit.name} disabled={item.isOther} maxLength={120}
                        onChange={(e) => setEdits((s) => ({ ...s, [item.id]: { ...s[item.id], name: e.target.value } }))}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950"/>
                    </label>
                    <label className="text-xs font-bold text-zinc-600">Unit price (€)
                      <input aria-label={item.name + " price"} inputMode="decimal"
                        value={item.isOther ? "Staff enters price" : edit.price} disabled={item.isOther}
                        onChange={(e) => setEdits((s) => ({ ...s, [item.id]: { ...s[item.id], price: e.target.value } }))}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-950"/>
                    </label>
                    <label className="text-xs font-bold text-zinc-600">Position
                      <input aria-label={item.name + " display position"} type="number" value={edit.sortOrder}
                        onChange={(e) => setEdits((s) => ({ ...s, [item.id]: { ...s[item.id], sortOrder: Number(e.target.value) } }))}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-950"/>
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-xs font-bold text-zinc-600">
                      <input aria-label={item.name + " active"} type="checkbox" checked={edit.active}
                        onChange={(e) => setEdits((s) => ({ ...s, [item.id]: { ...s[item.id], active: e.target.checked } }))}
                        className="h-5 w-5 accent-orange-600"/> Active
                    </label>
                    <button type="button" disabled={saving} onClick={() => void save(item)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4"/> Save</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
