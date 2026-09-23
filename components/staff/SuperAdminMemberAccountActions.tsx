"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string; memberNumber: string; fullName: string; updatedAt: string;
  status: string; archivedAt: string | null; archivedReason: string | null;
};
type Assessment = {
  eligible: boolean; blockers: string[]; memberNumber: string; fullName: string;
  status: string; updatedAt: string;
};
type Props = {
  member: Member; disabled: boolean; otherEditsPending: boolean;
  onBusyChange: (busy: boolean) => void; onUpdated: () => Promise<void>;
};

export default function SuperAdminMemberAccountActions({
  member, disabled, otherEditsPending, onBusyChange, onUpdated,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [confirmedNumber, setConfirmedNumber] = useState("");
  useEffect(() => {
    setReason(""); setError(""); setMessage(""); setAssessment(null); setConfirmedNumber("");
  }, [member.id]);
  useEffect(() => {
    setAssessment(null); setConfirmedNumber("");
  }, [member.updatedAt]);
  const archived = member.status === "archived";
  const blocked = busy || disabled || otherEditsPending || loadingAssessment;

  async function changeStatus(action: "archive" | "restore") {
    if (blocked || (action === "archive" && !reason.trim())) return;
    const prompt = action === "archive"
      ? "Archive " + member.fullName + " (" + member.memberNumber + ")? Their gym and app access will stop. Payment, audit and visit history remain."
      : "Restore " + member.fullName + " (" + member.memberNumber + ")? This never renews an expired or cancelled membership.";
    if (!window.confirm(prompt)) return;
    setBusy(true); onBusyChange(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/admin/members/" + encodeURIComponent(member.id) + "/account-status", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt: member.updatedAt, reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.status) throw new Error(data.error || "Could not update account status.");
      await onUpdated();
      setMessage(action === "archive"
        ? "Member archived and audited. App and gym entry are blocked."
        : "Member restored and audited. Current status: " + data.status + ". No membership was renewed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update account status.");
    } finally { setBusy(false); onBusyChange(false); }
  }

  async function assessDeletion() {
    if (blocked) return;
    setLoadingAssessment(true); setError(""); setMessage(""); setAssessment(null); setConfirmedNumber("");
    try {
      const response = await fetch("/api/system/admin/members/" + encodeURIComponent(member.id) + "/delete", {
        cache: "no-store", credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not assess deletion.");
      setAssessment(result.assessment as Assessment);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assess deletion.");
    } finally { setLoadingAssessment(false); }
  }

  async function permanentlyDelete() {
    if (blocked || !assessment?.eligible || confirmedNumber !== member.memberNumber
      || assessment.updatedAt !== member.updatedAt) return;
    if (!window.confirm("PERMANENTLY DELETE " + member.fullName + " (" + member.memberNumber
      + ")? This cannot be undone. Only records that pass the database dependency check can be deleted.")) return;
    setBusy(true); onBusyChange(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/admin/members/" + encodeURIComponent(member.id) + "/delete", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: member.updatedAt, confirmedMemberNumber: confirmedNumber }),
      });
      const result = await response.json();
      if (!response.ok || !result.deleted) throw new Error(result.error || "Deletion was not confirmed.");
      window.location.assign("/staff/admin/membership-tools?tool=members&deleted=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permanent deletion was not confirmed.");
      setAssessment(null); setConfirmedNumber("");
    } finally { setBusy(false); onBusyChange(false); }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7" aria-labelledby="account-actions-title">
      <h2 id="account-actions-title" className="text-xl font-black">Super Admin · Member account actions</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Archive and Restore change this member record, not its historical contracts, original expiry,
        audit events or payments. Permanent deletion is available only if the database dependency check passes.
      </p>
      <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm font-bold">
        {member.fullName} · {member.memberNumber} · {archived ? "ARCHIVED" : member.status.toUpperCase()}
        {member.archivedAt ? <p className="mt-1 text-xs font-normal">Archived {member.archivedAt}</p> : null}
      </div>
      {otherEditsPending && <p className="mt-3 text-sm font-semibold text-amber-800">
        Save or discard all unsaved profile, gym, date or cancellation changes first.
      </p>}
      {archived ? (
        <button type="button" disabled={blocked} onClick={() => void changeStatus("restore")}
          className="mt-4 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
          {busy ? "Working…" : "Restore member record"}
        </button>
      ) : (
        <div className="mt-4">
          <label className="block text-sm font-bold">
            Archive reason (required)
            <textarea value={reason} maxLength={500} rows={2} onChange={event => setReason(event.target.value)}
              disabled={blocked} className="mt-2 block w-full rounded-xl border border-zinc-300 p-3" />
          </label>
          <button type="button" disabled={blocked || !reason.trim()} onClick={() => void changeStatus("archive")}
            className="mt-3 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
            {busy ? "Working…" : "Archive member"}
          </button>
          <p className="mt-2 text-xs text-zinc-600">
            Active shared couples contracts must be resolved jointly before either partner can be archived.
          </p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
      <div className="mt-6 border-t border-zinc-200 pt-5">
        <h3 className="text-lg font-black text-red-800">Delete member permanently</h3>
        <p className="mt-2 text-sm text-zinc-600">
          This is not Archive. Deletion cannot be undone. Records with existing contracts, payments,
          cards, visits, photographs, imported data or audit history are blocked. A database check
          cannot establish whether separate exports or backups still exist.
        </p>
        <button type="button" disabled={blocked} onClick={() => void assessDeletion()}
          className="mt-3 rounded-xl border border-red-300 px-5 py-3 text-sm font-black text-red-800 disabled:opacity-50">
          {loadingAssessment ? "Checking…" : "Check permanent-delete eligibility"}
        </button>
        {assessment && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            {assessment.eligible
              ? <p className="font-bold text-red-900">
                  No linked records were found in the database dependency check. Confirm only after
                  checking your retention obligations and external copies.
                </p>
              : <p className="font-bold text-red-900">
                  Permanent deletion is blocked. This member has records that must not be silently removed:
                </p>}
            {assessment.blockers.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5">
              {assessment.blockers.map(item => <li key={item}>{item}</li>)}
            </ul>}
            {assessment.eligible && <div className="mt-4">
              <label className="block font-bold">
                Type {member.memberNumber} exactly to confirm
                <input value={confirmedNumber} autoComplete="off" onChange={event => setConfirmedNumber(event.target.value)}
                  disabled={blocked} className="mt-2 block w-full rounded-xl border border-red-300 bg-white p-3 font-mono" />
              </label>
              <button type="button" onClick={() => void permanentlyDelete()}
                disabled={blocked || confirmedNumber !== member.memberNumber || assessment.updatedAt !== member.updatedAt}
                className="mt-3 rounded-xl bg-red-800 px-5 py-3 font-black text-white disabled:opacity-50">
                Delete member permanently
              </button>
            </div>}
          </div>
        )}
      </div>
    </section>
  );
}
