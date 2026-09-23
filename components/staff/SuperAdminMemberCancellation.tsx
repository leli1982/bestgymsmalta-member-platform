"use client";

import { useEffect, useState } from "react";

export type CancellationEdit = {
  allowed: boolean;
  reason: string;
  membershipId: string | null;
  expectedMembershipUpdatedAt: string | null;
  effectiveDate: string | null;
  canWithdraw: boolean;
  today: string;
};
type Member = {
  id: string;
  memberNumber: string;
  fullName: string;
  status: string;
  membershipExpiry: string | null;
  cancellationEffectiveDate: string | null;
  cancellationReason: string;
  updatedAt: string;
};

export default function SuperAdminMemberCancellation({
  member, edit, otherEditsPending, disabled, onDraftChange, onBusyChange, onUpdated,
}: {
  member: Member;
  edit: CancellationEdit;
  otherEditsPending: boolean;
  disabled: boolean;
  onDraftChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onUpdated: () => Promise<void>;
}) {
  const [effectiveDate, setEffectiveDate] = useState(edit.effectiveDate || edit.today);
  const [reason, setReason] = useState(member.cancellationReason || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setEffectiveDate(edit.effectiveDate || edit.today);
    setReason(member.cancellationReason || "");
    onDraftChange(false);
  }, [member.updatedAt, edit.effectiveDate, edit.today, member.cancellationReason, onDraftChange]);
  const dirty = effectiveDate !== (edit.effectiveDate || edit.today)
    || reason !== (member.cancellationReason || "");
  const max = member.membershipExpiry || undefined;
  const dateInvalid = !effectiveDate || effectiveDate < edit.today || Boolean(max && effectiveDate > max);
  const blocked = disabled || busy || otherEditsPending || !edit.allowed;

  async function submit(action: "cancel" | "withdraw", requestedDate: string | null) {
    if (blocked) return;
    if (action === "cancel" && (dateInvalid || !requestedDate)) {
      setError("Choose a valid cancellation date between today and the recorded membership expiry.");
      return;
    }
    if (action === "withdraw" && !edit.canWithdraw) return;
    const confirmation = action === "withdraw"
      ? `Withdraw the pending cancellation for ${member.fullName} (${member.memberNumber})? The existing membership expiry will continue to apply.`
      : `Confirm cancellation for ${member.fullName} (${member.memberNumber}), effective ${requestedDate}? ${requestedDate === edit.today ? "Gym entry will be denied immediately." : "Gym entry will be denied at Malta midnight on that date."} Past payments and visit history will not be deleted.`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(member.id)}/cancellation`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action, effectiveDate: action === "withdraw" ? null : requestedDate,
          reason: action === "withdraw" ? "" : reason,
          membershipId: edit.membershipId,
          expectedMembershipUpdatedAt: edit.expectedMembershipUpdatedAt,
          expectedMemberUpdatedAt: member.updatedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update membership cancellation.");
      await onUpdated();
      setMessage(action === "withdraw"
        ? "Pending membership cancellation withdrawn and audited."
        : result.changed
          ? `Membership cancellation recorded and audited. Access stops on ${result.effectiveDate} (Malta date).`
          : "The same cancellation is already recorded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not process membership cancellation.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4" aria-labelledby="cancel-membership-title">
      <h3 id="cancel-membership-title" className="text-base font-black text-red-950">Cancel membership</h3>
      <p className="mt-2 text-sm text-red-900">
        The effective date is the first day access is denied, starting at midnight in Malta.
        Existing expiry dates, permanent BGM number, assigned card, past visits, and paid transactions stay recorded.
      </p>
      <p className="mt-2 text-sm font-semibold text-red-950">{edit.reason}</p>
      {edit.effectiveDate && (
        <p className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-red-900">
          {edit.effectiveDate <= edit.today
            ? "Cancellation effective since " : "Cancellation scheduled for "}
          {edit.effectiveDate}.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-zinc-950">
          Cancellation effective date
          <input type="date" value={effectiveDate} min={edit.today} max={max}
            onChange={(event) => {
              const next = event.target.value;
              setEffectiveDate(next);
              onDraftChange(next !== (edit.effectiveDate || edit.today)
                || reason !== (member.cancellationReason || ""));
              setError(""); setMessage("");
            }}
            disabled={blocked}
            className="mt-1 block w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-base text-zinc-950 disabled:opacity-60"/>
        </label>
        <label className="block text-sm font-bold text-zinc-950">
          Cancellation notes (optional)
          <textarea value={reason} rows={2} maxLength={500}
            onChange={(event) => {
              const next = event.target.value;
              setReason(next);
              onDraftChange(effectiveDate !== (edit.effectiveDate || edit.today)
                || next !== (member.cancellationReason || ""));
              setError(""); setMessage("");
            }}
            disabled={blocked}
            className="mt-1 block w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-base text-zinc-950 disabled:opacity-60"/>
        </label>
      </div>
      {otherEditsPending && <p className="mt-3 text-sm font-bold text-amber-950">
        Save or discard unsaved personal details, enrollment gym, or membership date changes before cancelling.
      </p>}
      {error && <p role="alert" className="mt-3 text-sm font-bold text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm font-bold text-emerald-800">{message}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={blocked || dateInvalid || Boolean(edit.effectiveDate && !dirty)}
          onClick={() => void submit("cancel", effectiveDate)}
          className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
          {busy ? "Processing…" : effectiveDate === edit.today ? "Cancel membership now"
            : edit.effectiveDate ? "Update scheduled cancellation" : "Schedule cancellation"}
        </button>
        {edit.canWithdraw && (
          <button type="button" disabled={blocked}
            onClick={() => void submit("withdraw", null)}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-900 disabled:opacity-50">
            Withdraw pending cancellation
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-red-900">
        {edit.allowed
          ? "This action applies only to the selected member. Once cancellation takes effect, this form cannot reverse it; a new membership requires the authorised renewal process."
          : "This individual cancellation action is unavailable for this member. Review the eligibility message above; shared couples memberships must use the separate joint action."}
      </p>
    </section>
  );
}
