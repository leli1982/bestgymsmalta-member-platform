"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatBarEuro, parseEuroCents } from "@/lib/barSalesCore";

type Voucher = {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  reimbursementValueCents: number | null;
};

export default function VoucherReimbursementAdmin() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/system/voucher-reimbursements", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load voucher values.");
      const rows = (payload.vouchers || []) as Voucher[];
      setVouchers(rows);
      setInputs(Object.fromEntries(rows.map((voucher) => [voucher.id, voucher.reimbursementValueCents === null ? "" : (voucher.reimbursementValueCents / 100).toFixed(2)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load voucher values.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let host: HTMLDivElement | null = null;
    const attach = () => {
      if (host?.isConnected) return true;
      const declarations = document.getElementById("rules-declarations");
      const parent = declarations?.parentElement;
      if (!declarations || !parent) return false;
      host = document.createElement("div");
      host.dataset.bgmVoucherValueSlot = "true";
      parent.insertBefore(host, declarations);
      setPortalHost(host);
      return true;
    };

    if (attach()) {
      return () => { host?.remove(); };
    }

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, []);

  async function save(voucher: Voucher) {
    const raw = inputs[voucher.id] || "";
    const value = raw.trim() ? parseEuroCents(raw) : null;
    if (raw.trim() && value === null) {
      setError(`Enter a valid Value € for ${voucher.code}, or leave it blank.`);
      return;
    }
    setSavingId(voucher.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/voucher-reimbursements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: voucher.id, reimbursementValueCents: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save voucher value.");
      setVouchers((current) => current.map((row) => row.id === voucher.id ? payload.voucher : row));
      setMessage(`${voucher.code} reimbursement value saved. Future new memberships will snapshot this value.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save voucher value.");
    } finally {
      setSavingId("");
    }
  }

  const content = (
    <section className="bgm-admin-light text-zinc-950">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a0a]">Voucher accounting</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Voucher Value €</h2>
          <p className="mt-1 text-sm text-zinc-500">Each voucher keeps its Discount % above. Optional Value € is reimbursement income paid to BestGymsMalta for each successful NEW membership. Leave blank for normal percentage-discount behaviour only.</p>
          <p className="mt-2 text-xs font-bold text-zinc-500">The value is snapshotted when the membership activates. Changing it later never changes historical memberships or End of Day reports.</p>
        </div>
        {message && <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div>}
        {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        {loading ? <p className="mt-5 text-sm font-bold text-zinc-500">Loading vouchers…</p> : (
          <div className="mt-5 grid gap-3">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="grid gap-3 rounded-2xl border border-zinc-200 p-4 sm:grid-cols-[1fr_150px_180px_auto] sm:items-end">
                <div><p className="font-black">{voucher.code}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{voucher.active ? "Active" : "Inactive"}</p></div>
                <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-500">Discount %</span><strong className="mt-2 block text-lg">{voucher.percentage}%</strong></div>
                <label className="text-xs font-black text-zinc-600">Value € (optional)
                  <input aria-label={`${voucher.code} Value €`} inputMode="decimal" value={inputs[voucher.id] || ""} onChange={(event) => setInputs((current) => ({ ...current, [voucher.id]: event.target.value }))} placeholder="Blank" className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-bold text-zinc-950" />
                </label>
                <button type="button" disabled={savingId === voucher.id} onClick={() => void save(voucher)} className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{savingId === voucher.id ? "Saving…" : "Save Value"}</button>
                {voucher.reimbursementValueCents !== null && <p className="sm:col-span-4 text-xs font-bold text-zinc-500">Current reimbursement snapshot value: {formatBarEuro(voucher.reimbursementValueCents)} per successful NEW membership.</p>}
              </div>
            ))}
            {vouchers.length === 0 && <p className="text-sm font-bold text-zinc-500">No vouchers have been created yet. Create the discount code above first.</p>}
          </div>
        )}
      </div>
    </section>
  );

  return portalHost ? createPortal(content, portalHost) : null;
}
