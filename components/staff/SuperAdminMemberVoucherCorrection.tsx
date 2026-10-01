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

function money(cents: number | null | undefined, currency = "EUR") {
  return cents == null ? "Not recorded" : new Intl.NumberFormat("en-MT", {
    style: "currency", currency: currency || "EUR",
  }).format(cents / 100);
}

export default function SuperAdminMemberVoucherCorrection({
  memberId, memberships, vouchers, disabled, onUpdated,
}: {
  memberId: string;
  memberships: Membership[];
  vouchers: Voucher[];
  disabled: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const eligible = useMemo(() => memberships.filter((item) =>
    item.status === "active" && item.participantCount === 1 && item.application
      && item.application.payment_received_at
      && item.application.base_price_cents !== null
      && item.application.final_amount_cents !== null
  ), [memberships]);
  const [selection, setSelection] = useState<Record<string, string>>({});
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
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: item.id,
          expectedApplicationUpdatedAt: application.updated_at,
          voucherCode: voucher.code,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not apply voucher.");
      await onUpdated();
      setSelection((current) => ({ ...current, [item.id]: "" }));
      setMessage(
        body.changed
          ? `${body.voucherCode} applied. Refund due: ${money(body.refundDueCents, application.currency)}. Refund alert recorded; email notification: ${body.emailNotificationStatus}.`
          : "That voucher is already applied."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not apply voucher.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-3xl border border-orange-200 bg-orange-50 p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <TicketCheck className="text-orange-700" size={22}/>
        <h2 className="text-xl font-black">Voucher / paid-membership correction</h2>
      </div>
      <p className="mt-2 text-sm text-orange-950">
        Super Admin only. Use this when staff forgot to apply a voucher before taking payment.
        The original transaction remains auditable; the corrected final amount is saved and a refund-required alert is created.
      </p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}
      {memberships.some((item) => item.status === "active" && item.participantCount > 1) && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          Shared/couples memberships are protected from individual voucher correction and require a joint workflow.
        </p>
      )}
      {eligible.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-zinc-600">No individual active paid membership is eligible for a retroactive voucher correction.</p>
      ) : (
        <div className="mt-4 space-y-3">
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
                      {available.map((voucher) => (
                        <option key={voucher.id} value={voucher.code}>
                          {voucher.code} · {voucher.percentage}%{voucher.max_uses === null ? "" : ` · max ${voucher.max_uses}`}
                        </option>
                      ))}
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
        </div>
      )}
    </section>
  );
}
