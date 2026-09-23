"use client";

import { useEffect, useState } from "react";

export type CouplesCancellationEdit = {
  allowed: boolean; reason: string; canWithdraw: boolean;
  membershipId: string; expectedMembershipUpdatedAt: string;
  effectiveDate: string | null; today: string; expiryDate: string;
  partner: { id: string; fullName: string; memberNumber: string; updatedAt: string };
};

export default function SuperAdminCouplesCancellation({
  member, edit, otherEditsPending, disabled, onDraftChange, onBusyChange, onUpdated,
}: {
  member: { id: string; fullName: string; memberNumber: string; updatedAt: string };
  edit: CouplesCancellationEdit;
  otherEditsPending: boolean; disabled: boolean;
  onDraftChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onUpdated: () => Promise<void>;
}) {
  const [date, setDate] = useState(edit.effectiveDate || edit.today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setDate(edit.effectiveDate || edit.today);
    setReason("");
    onDraftChange(false);
  }, [edit.effectiveDate, edit.today, member.updatedAt, edit.partner.updatedAt, onDraftChange]);
  const changed = date !== (edit.effectiveDate || edit.today) || Boolean(reason.trim());
  const invalid = !date || date < edit.today || date > edit.expiryDate;
  const blocked = disabled || busy || otherEditsPending || !edit.allowed;
  async function submit(action: "cancel" | "withdraw") {
    if (blocked || (action === "cancel" && invalid) || (action === "withdraw" && !edit.canWithdraw)) return;
    const identities = member.fullName + " (" + member.memberNumber + ") AND "
      + edit.partner.fullName + " (" + edit.partner.memberNumber + ")";
    const warning = action === "cancel"
      ? "Cancel the shared couples membership for BOTH " + identities + " effective " + date
        + "? Both partners lose gym access " + (date === edit.today ? "immediately." : "at Malta midnight on that date.")
        + " Their separate identities, cards, previous visits and payments remain recorded."
      : "Withdraw the pending cancellation for BOTH " + identities + "?";
    if (!window.confirm(warning)) return;
    setBusy(true); onBusyChange(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/admin/members/" + encodeURIComponent(member.id) + "/couples-cancellation", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, effectiveDate: action === "cancel" ? date : null,
          reason: action === "cancel" ? reason : "",
          membershipId: edit.membershipId, partnerId: edit.partner.id,
          expectedMemberUpdatedAt: member.updatedAt,
          expectedPartnerUpdatedAt: edit.partner.updatedAt,
          expectedMembershipUpdatedAt: edit.expectedMembershipUpdatedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the shared membership.");
      await onUpdated();
      setMessage(action === "withdraw"
        ? "Pending couples cancellation withdrawn for both partners and audited."
        : result.changed
          ? "Couples membership cancellation saved for both partners and audited. Access stops on " + result.effectiveDate + " (Malta date)."
          : "The same couples cancellation is already recorded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The joint action could not be confirmed.");
    } finally {
      setBusy(false); onBusyChange(false);
    }
  }
  return <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4" aria-labelledby="couples-cancellation-title">
    <h3 id="couples-cancellation-title" className="text-base font-black text-red-950">Cancel shared couples membership — both partners</h3>
    <p className="mt-2 text-sm font-bold text-red-950">{member.fullName} ({member.memberNumber})</p>
    <p className="text-sm font-bold text-red-950">{edit.partner.fullName} ({edit.partner.memberNumber})</p>
    <p className="mt-2 text-sm text-red-900">{edit.reason}</p>
    {edit.effectiveDate && <p className="mt-2 text-sm font-bold text-red-950">
      {edit.canWithdraw ? "Joint cancellation scheduled for " : "Joint cancellation effective from "}{edit.effectiveDate}
    </p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold text-zinc-950">Effective date — both partners
        <input type="date" value={date} min={edit.today} max={edit.expiryDate} disabled={blocked}
          onChange={(event) => { setDate(event.target.value); onDraftChange(event.target.value !== (edit.effectiveDate || edit.today) || Boolean(reason.trim())); setError(""); setMessage(""); }}
          className="mt-1 block w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-base disabled:opacity-60" />
      </label>
      <label className="text-sm font-bold text-zinc-950">Notes (optional)
        <textarea rows={2} maxLength={500} value={reason} disabled={blocked}
          onChange={(event) => { setReason(event.target.value); onDraftChange(date !== (edit.effectiveDate || edit.today) || Boolean(event.target.value.trim())); setError(""); setMessage(""); }}
          className="mt-1 block w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-base disabled:opacity-60" />
      </label>
    </div>
    {otherEditsPending && <p className="mt-2 text-sm font-bold text-amber-900">Save or discard other unsaved changes before changing the shared membership.</p>}
    {error && <p role="alert" className="mt-2 text-sm font-bold text-red-800">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm font-bold text-emerald-800">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={blocked || invalid || Boolean(edit.effectiveDate && !changed)}
        onClick={() => void submit("cancel")}
        className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
        {busy ? "Processing…" : date === edit.today ? "Cancel BOTH memberships now" : "Schedule cancellation for BOTH"}
      </button>
      {edit.canWithdraw && <button type="button" disabled={blocked} onClick={() => void submit("withdraw")}
        className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">
        Withdraw BOTH pending cancellations
      </button>}
    </div>
    <p className="mt-3 text-xs text-red-900">This action changes the shared contract and both access records together. It does not change original expiry, visits or transactions. After the effective date, use the authorised new-membership process.</p>
  </section>;
}
