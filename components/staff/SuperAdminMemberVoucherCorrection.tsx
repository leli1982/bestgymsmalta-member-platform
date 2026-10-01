"use client";

import { useMemo, useState } from "react";
import { TicketCheck, TriangleAlert } from "lucide-react";

type Voucher = {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  successful_uses: number;
};

type Membership = {
  id: string;
  status: string;
  participantCount: number;
  application: {
    application_reference: string;
    base_price_cents: number | null;
    discount_code_snapshot: string | null;
    discount_percentage_snapshot: number | null;
    discount_amount_cents: number | null;
    final_amount_cents: number | null;
    currency: string;
    payment_received_at: string | null;
    updated_at: string;
  } | null;
};

type LegacyCorrection = {
  id: string;
  voucher_code: string;
  voucher_percentage: number;
  confirmed_original_paid_cents: number;
  corrected_final_amount_cents: number;
  refund_due_cents: number;
  currency: string;
  membership_expiry_snapshot: string | null;
  applied_at: string;
} | null;

function money(cents: number | null | undefined, currency = "EUR") {
  return cents == null ? "Not recorded" : new Intl.NumberFormat("en-MT", {
    style: "currency", currency: currency || "EUR",
  }).format(cents / 100);
}

export default function SuperAdminMemberVoucherCorrection({
  memberId, memberStatus, expectedMemberUpdatedAt, memberships, vouchers,
  legacyCorrection, disabled, onUpdated,
}: {
  memberId: string;
  memberStatus: string;
  expectedMemberUpdatedAt: string;
  memberships: Membership[];
  vouchers: Voucher[];
  legacyCorrection: LegacyCorrection;
  disabled: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const eligible = useMemo(() => memberships.filter((item) =>
    item.status === "active" && item.participantCount === 1 && item.application
      && item.application.payment_received_at
      && item.application.base_price_cents !== null
      && item.application.final_amount_cents !== null
  ), [memberships]);
  const hasActiveModernMembership = memberships.some((item) => item.status === "active");
  const legacyEligible = memberStatus === "active" && memberships.length === 0 && !legacyCorrection;

  const [selection, setSelection] = useState<Record<string, string>>({});
  const [legacyVoucher, setLegacyVoucher] = useState("");
  const [legacyPaid, setLegacyPaid] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const available = vouchers.filter((voucher) =>
    voucher.active
    && (!voucher.valid_from || voucher.valid_from <= today)
    && (!voucher.valid_until || voucher.valid_until >= today)
    && (voucher.max_uses === null || voucher.successful_uses < voucher.max_uses)
  );

  async function notifyResult(body: any, currency = "EUR") {
    await onUpdated();
    setMessage(
      body.changed
        ? `${body.voucherCode} applied. Refund due: ${money(body.refundDueCents, currency)}. Refund alert recorded; email notification: ${body.emailNotificationStatus}.`
        : "That voucher is already applied."
    );
  }

  async function apply(item: Membership) {
    const code = selection[item.id] || "";
    const voucher = available.find((entry) => entry.code === code);
    const application = item.application;
    if (!voucher || !application || busy) return;

    const newDiscount = Math.round((application.base_price_cents || 0) * voucher.percentage / 100);
    const newFinal = Math.max((application.base_price_cents || 0) - newDiscount, 0);
    const refund = (application.final_amount_cents || 0) - newFinal;
    if (refund <= 0) {
      setError("This voucher would not reduce the amount already paid, so no refund correction can be created.");
      return;
    }
    if (!window.confirm(`Apply ${voucher.code} (${voucher.percentage}%) and create a refund alert for ${money(refund, application.currency)}?`)) return;

    setBusy(item.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}/voucher`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctionKind: "transaction",
          membershipId: item.id,
          expectedApplicationUpdatedAt: application.updated_at,
          voucherCode: voucher.code,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not apply voucher.");
      setSelection((current) => ({ ...current, [item.id]: "" }));
      await notifyResult(body, application.currency);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not apply voucher.");
    } finally {
      setBusy("");
    }
  }

  async function applyLegacy() {
    const voucher = available.find((entry) => entry.code === legacyVoucher);
    const paid = Number(legacyPaid);
    const originalPaidCents = Number.isFinite(paid) ? Math.round(paid * 100) : 0;
    if (!voucher || originalPaidCents <= 0 || busy) {
      setError("Enter the amount originally paid and choose a voucher.");
      return;
    }
    const refund = Math.round(originalPaidCents * voucher.percentage / 100);
    if (refund <= 0) {
      setError("This voucher would not create a refund.");
      return;
    }
    if (!window.confirm(
      `Confirm that the member originally paid ${money(originalPaidCents)}. Apply ${voucher.code} (${voucher.percentage}%) and flag a ${money(refund)} refund?`
    )) return;

    setBusy("legacy"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/system/admin/members/${encodeURIComponent(memberId)}/voucher`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctionKind: "legacy",
          expectedMemberUpdatedAt,
          voucherCode: voucher.code,
          originalPaidCents,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not apply voucher.");
      setLegacyVoucher("");
      setLegacyPaid("");
      await notifyResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not apply voucher.");
    } finally {
      setBusy("");
    }
  }

  const selectedLegacy = available.find((entry) => entry.code === legacyVoucher);
  const legacyPaidCents = Number.isFinite(Number(legacyPaid)) ? Math.round(Number(legacyPaid) * 100) : 0;
  const legacyRefund = selectedLegacy && legacyPaidCents > 0
    ? Math.round(legacyPaidCents * selectedLegacy.percentage / 100) : 0;

  return (
    <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <TicketCheck className="text-orange-700" size={22}/>
        <h2 className="text-xl font-black">Voucher / paid-membership correction</h2>
      </div>
      <p className="mt-2 text-sm text-orange-950">
        Super Admin only. Use this when staff forgot to apply a voucher before taking payment.
        Transaction-backed payments are recalculated from their saved price. Imported legacy members require Super Admin to confirm the amount originally paid; no historical amount is invented.
      </p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}

      {memberships.some((item) => item.status === "active" && item.participantCount > 1) && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          Shared/couples memberships are protected from individual voucher correction and require a joint workflow.
        </p>
      )}

      {eligible.length > 0 && <div className="mt-4 space-y-3">
        {eligible.map((item) => {
          const application = item.application!;
          const selected = available.find((entry) => entry.code === selection[item.id]);
          const newDiscount = selected && application.base_price_cents !== null
            ? Math.round(application.base_price_cents * selected.percentage / 100) : 0;
          const estimatedRefund = selected
            ? Math.max((application.final_amount_cents || 0) - Math.max((application.base_price_cents || 0) - newDiscount, 0), 0)
            : 0;
          return (
            <div key={item.id} className="rounded-2xl border border-orange-200 bg-white p-4">
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>Application <strong>{application.application_reference}</strong></p>
                <p>Paid/final <strong>{money(application.final_amount_cents, application.currency)}</strong></p>
                <p>Current voucher <strong>{application.discount_code_snapshot || "None"}</strong></p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="text-sm font-bold">Apply voucher
                  <select value={selection[item.id] || ""} disabled={disabled || busy === item.id}
                    onChange={(event) => { setSelection((current) => ({ ...current, [item.id]: event.target.value })); setError(""); setMessage(""); }}
                    className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base">
                    <option value="">Select voucher</option>
                    {available.map((voucher) => <option key={voucher.id} value={voucher.code}>
                      {voucher.code} · {voucher.percentage}%{voucher.max_uses === null ? "" : ` · max ${voucher.max_uses}`}
                    </option>)}
                  </select>
                </label>
                <button type="button" onClick={() => void apply(item)}
                  disabled={disabled || busy !== "" || !selection[item.id] || estimatedRefund <= 0}
                  className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:bg-zinc-300">
                  {busy === item.id ? "Applying…" : "Apply voucher"}
                </button>
              </div>
              {selected && <p className="mt-2 flex items-center gap-2 text-sm font-black text-red-700">
                <TriangleAlert size={16}/> Refund that will be flagged: {money(estimatedRefund, application.currency)}
              </p>}
            </div>
          );
        })}
      </div>}

      {legacyCorrection && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
          <p className="font-black text-emerald-800">Legacy voucher correction already recorded</p>
          <p className="mt-2 text-sm font-semibold">
            {legacyCorrection.voucher_code} · {legacyCorrection.voucher_percentage}% · Original paid {money(legacyCorrection.confirmed_original_paid_cents, legacyCorrection.currency)} · Refund {money(legacyCorrection.refund_due_cents, legacyCorrection.currency)}
          </p>
        </div>
      )}

      {legacyEligible && (
        <div className="mt-4 rounded-2xl border border-orange-300 bg-white p-4">
          <h3 className="font-black">Imported / legacy member</h3>
          <p className="mt-1 text-sm text-zinc-600">
            No payment transaction exists for this member. Confirm the amount actually paid before applying a voucher. This value is stored as an audited Super Admin correction.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Original amount paid (€)
              <input type="number" min="0.01" max="100000" step="0.01" inputMode="decimal"
                value={legacyPaid}
                onChange={(event) => { setLegacyPaid(event.target.value); setError(""); setMessage(""); }}
                placeholder="e.g. 120.00"
                className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base"/>
            </label>
            <label className="text-sm font-bold">Apply voucher
              <select value={legacyVoucher}
                onChange={(event) => { setLegacyVoucher(event.target.value); setError(""); setMessage(""); }}
                className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base">
                <option value="">Select voucher</option>
                {available.map((voucher) => <option key={voucher.id} value={voucher.code}>
                  {voucher.code} · {voucher.percentage}%{voucher.max_uses === null ? "" : ` · max ${voucher.max_uses}`}
                </option>)}
              </select>
            </label>
          </div>
          {selectedLegacy && legacyPaidCents > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
              <p><strong>Confirmed original paid:</strong> {money(legacyPaidCents)}</p>
              <p><strong>Corrected final amount:</strong> {money(legacyPaidCents - legacyRefund)}</p>
              <p className="font-black text-red-800"><TriangleAlert className="mr-1 inline h-4 w-4"/>Refund that will be flagged: {money(legacyRefund)}</p>
            </div>
          )}
          <button type="button" onClick={() => void applyLegacy()}
            disabled={disabled || busy !== "" || !legacyVoucher || legacyPaidCents <= 0 || legacyRefund <= 0}
            className="mt-4 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:bg-zinc-300">
            {busy === "legacy" ? "Applying…" : "Confirm amount & apply voucher"}
          </button>
        </div>
      )}

      {eligible.length === 0 && !legacyEligible && !legacyCorrection && !hasActiveModernMembership && (
        <p className="mt-4 text-sm font-semibold text-zinc-600">No current membership is eligible for a retroactive voucher correction.</p>
      )}
    </section>
  );
}
