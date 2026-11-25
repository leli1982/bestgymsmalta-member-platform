"use client";

import { useRef, useState } from "react";

type Association = {
  id?: string; memberId: string | null; memberNumber?: string | null;
  fullName?: string | null; status?: string; applicationMemberId?: string | null;
};
type Lookup = {
  barcode: string; status: string; canRelease: boolean; blockedReason?: string | null;
  credentials: Association[]; legacyClaims: Association[]; aliases: Association[];
  previousMember?: Association & { releasedAt?: string };
};
const endpoint = "/api/system/admin/card-management";

export default function SuperAdminCardManagement() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmActive, setConfirmActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const running = useRef(false);
  function reset() {
    setResult(null); setReason(""); setConfirmed(false); setConfirmActive(false);
    setError(""); setSuccess("");
  }
  async function search() {
    if (running.current || !barcode.trim()) return;
    running.current = true; setBusy(true); reset();
    try {
      const response = await fetch(endpoint + "?barcode=" + encodeURIComponent(barcode.trim()), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lookup failed.");
      setResult(data); setBarcode(data.barcode);
    } catch (e) { setError(e instanceof Error ? e.message : "Lookup failed."); }
    finally { running.current = false; setBusy(false); }
  }
  async function release() {
    if (running.current || !result?.canRelease || !confirmed || !reason.trim() ||
      (result.status === "active" && !confirmActive)) return;
    running.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: result.barcode, expected: result, reason, confirmed, confirmActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Release failed.");
      if (data.status !== "available") throw new Error("Availability was not confirmed. Search again.");
      setResult(data); setReason(""); setConfirmed(false); setConfirmActive(false);
      setSuccess(data.barcode + " released successfully and available for reassignment.");
    } catch (e) {
      setResult(null); setConfirmed(false); setConfirmActive(false);
      setError(e instanceof Error ? e.message : "Release not confirmed. Search again.");
    } finally { running.current = false; setBusy(false); }
  }
  function associations(title: string, rows: Association[]) {
    if (!rows.length) return null;
    return <div className="space-y-2"><h3 className="text-sm font-black">{title}</h3>
      {rows.map((row, i) => <div key={row.id || row.memberId || i} className="rounded-xl border border-zinc-200 p-3 text-sm">
        <p className="font-bold">{row.memberNumber || (row.applicationMemberId ? "Unfinished application" : "No member assigned")} {row.fullName ? " · " + row.fullName : ""}</p>
        {row.status && <p className="capitalize text-zinc-600">{row.status}</p>}
      </div>)}</div>;
  }
  return <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 text-zinc-950 sm:p-7">
    <div><h2 className="text-2xl font-black">Card Management</h2>
      <p className="mt-1 text-sm text-zinc-600">Search a physical card and release it for reuse without changing membership terms or deleting card history.</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void search(); }}>
      <input aria-label="Physical card number" value={barcode} maxLength={128} disabled={busy}
        onChange={e => { setBarcode(e.target.value); reset(); }} placeholder="Physical card number"
        className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-3 font-bold" />
      <button type="submit" disabled={busy || !barcode.trim()} className="rounded-xl bg-[#ffb400] px-5 py-3 font-black text-black disabled:opacity-50">{busy ? "Working…" : "Search card"}</button>
    </form>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800">{success}</p>}
    {result && <div className="space-y-4 rounded-2xl border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-black">{result.barcode}</p>
        <span className={"rounded-full px-3 py-1 text-sm font-black uppercase " + (result.status === "available" ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-900")}>{result.status}</span>
      </div>
      {associations("Physical credential", result.credentials)}
      {associations("Legacy claims", result.legacyClaims)}
      {associations("Customer identifier matches", result.aliases)}
      {result.previousMember && associations("Previous released owner", [result.previousMember])}
      {result.blockedReason && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{result.blockedReason}</p>}
      {result.status === "available" && <p className="text-sm text-emerald-800">No active assignment or reservation found. Available for reassignment.</p>}
      {result.canRelease && <div className="space-y-3 border-t border-zinc-200 pt-4">
        <label className="block text-sm font-black">Reason for release
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} disabled={busy}
            rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 p-3 font-normal" required />
        </label>
        <label className="flex items-start gap-2 text-sm font-bold">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} className="mt-1 accent-[#ffb400]" />
          I confirm that this physical card number should be released for reuse.
        </label>
        {result.status === "active" && <label className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900">
          <input type="checkbox" checked={confirmActive} disabled={busy} onChange={e => setConfirmActive(e.target.checked)} className="mt-1" />
          I understand the current member will lose access using this physical card. Their membership will remain unchanged.
        </label>}
        <button type="button" onClick={() => void release()} disabled={busy || !confirmed || !reason.trim() || (result.status === "active" && !confirmActive)}
          className="rounded-xl bg-red-700 px-5 py-3 font-black text-white disabled:opacity-40">Release Card Number</button>
      </div>}
    </div>}
  </section>;
}
