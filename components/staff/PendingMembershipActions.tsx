"use client";

import { useEffect, useState } from "react";
import OfficialMemberPhotoCapture from "@/components/staff/OfficialMemberPhotoCapture";

type Participant = {
  id: string;
  participantOrder: number;
  fullName: string;
  existingMemberId: string | null;
  hasPhoto: boolean;
  photoUrl: string | null;
  reservedBarcode: string | null;
  currentBarcode: string | null;
  cardVerified: boolean;
  renewalCardAction: "keep" | "replace" | null;
  scannedBarcode: string | null;
};

type Application = {
  id: string;
  reference: string;
  kind: "new" | "renewal";
  membershipType: string;
  status: string;
  staffName: string;
  basePriceCents: number | null;
  currency: string;
  participants: Participant[];
};

export default function PendingMembershipActions() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [openId, setOpenId] = useState("");
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [activationStaffNames, setActivationStaffNames] = useState<Record<string, string>>({});
  const [discountCodes, setDiscountCodes] = useState<Record<string, string>>({});
  const [discountPreviews, setDiscountPreviews] = useState<Record<string, {
    code: string;
    percentage: number;
    basePriceCents: number;
    discountAmountCents: number;
    finalAmountCents: number;
    currency: string;
  }>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, "cash" | "card" | "other" | "">>({});
  const [paymentOtherTexts, setPaymentOtherTexts] = useState<Record<string, string>>({});
  const [activatingId, setActivatingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/system/members/card/assign", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load pending memberships.");
        return;
      }
      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch {
      setError("Could not load pending memberships.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function processCard(application: Application, participant: Participant) {
    const barcode = (barcodes[participant.id] || "").trim();
    if (!barcode) {
      setError(participant.existingMemberId ? "Scan the membership card first." : "Scan the preprinted membership card first.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/members/card/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationMemberId: participant.id, barcode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not process membership card.");
        return;
      }

      if (data.verification) {
        setMessage(
          data.verification.renewalCardAction === "keep"
            ? `Card ${data.verification.scannedBarcode} verified — current card will stay active.`
            : `Card ${data.verification.scannedBarcode} reserved as the replacement card.`
        );
      } else {
        setMessage(`Card ${data.reservation.barcodeValue} reserved.`);
      }
      setBarcodes((current) => ({ ...current, [participant.id]: "" }));
      await load();
    } catch {
      setError("Could not process membership card.");
    }
  }

  function isReady(application: Application) {
    return application.participants.every((participant) =>
      (participant.existingMemberId ? participant.cardVerified : Boolean(participant.reservedBarcode))
    );
  }

  async function applyDiscountCode(application: Application) {
    const code = (discountCodes[application.id] || "").trim();
    if (!code) {
      setDiscountPreviews((current) => {
        const next = { ...current };
        delete next[application.id];
        return next;
      });
      return;
    }

    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(application.id)}/discount`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Discount code is unavailable.");
        return;
      }
      setDiscountCodes((current) => ({ ...current, [application.id]: data.code }));
      setDiscountPreviews((current) => ({ ...current, [application.id]: data }));
    } catch {
      setError("Could not validate the discount code.");
    }
  }

  async function activateApplication(application: Application) {
    const activationStaffName = (activationStaffNames[application.id] || "").trim();
    const paymentMethod = paymentMethods[application.id] || "";
    const paymentOtherText = (paymentOtherTexts[application.id] || "").trim();
    const discountCode = (discountCodes[application.id] || "").trim();
    const discountPreview = discountPreviews[application.id];
    const readyToActivate = isReady(application);

    if (!readyToActivate) {
      setError(
        "Every participant needs the required membership card action before activation."
      );
      return;
    }

    if (!activationStaffName) {
      setError("Payment Staff Name is required before payment can be confirmed.");
      return;
    }
    if (!paymentMethod) {
      setError("Select Cash, Card or Other as the payment method.");
      return;
    }
    if (paymentMethod === "other" && !paymentOtherText) {
      setError("Describe the Other payment method.");
      return;
    }
    if (discountCode && !discountPreview) {
      setError("Apply the discount code before confirming payment.");
      return;
    }

    setActivatingId(application.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/system/members/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          applicationId: application.id,
          paymentMethod,
          paymentOtherText: paymentMethod === "other" ? paymentOtherText : "",
          staffName: activationStaffName,
          discountCode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not activate membership.");
        return;
      }

      setMessage(`${application.reference} activated successfully.`);
      setOpenId("");
      setActivationStaffNames((current) => ({ ...current, [application.id]: "" }));
      await load();
    } catch {
      setError("Could not activate membership.");
    } finally {
      setActivatingId("");
    }
  }

  if (applications.length === 0) return null;

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Membership action required</p>
          <h2 className="mt-1 text-xl font-black">MEMBERSHIP READY — CARD ACTION REQUIRED</h2>
        </div>
        <span className="rounded-full bg-orange-600 px-3 py-1 text-xs font-black text-white">{applications.length}</span>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="mt-4 space-y-3">
        {applications.map((application) => {
          const renewal = application.kind === "renewal";
          const readyToActivate = isReady(application);

          return (
            <div key={application.id} className="rounded-xl border border-orange-200 bg-white p-4">
              <button type="button" onClick={() => setOpenId(openId === application.id ? "" : application.id)} className="flex w-full items-center justify-between gap-4 text-left">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                    {renewal ? "RENEWAL READY — VERIFY CARD" : "NEW MEMBERSHIP READY — SCAN CARD"}
                  </p>
                  <p className="mt-1 font-black">{application.reference}</p>
                  <p className="text-sm text-zinc-500">{application.participants.map((participant) => participant.fullName).join(" + ")}</p>
                </div>
                <span className="text-sm font-bold text-orange-700">{openId === application.id ? "Close" : "Open"}</span>
              </button>

              {openId === application.id && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {application.participants.map((participant) => (
                    <div key={participant.id} className="rounded-xl border border-zinc-200 p-4">
                      <p className="font-black">{participant.fullName}</p>
                      {participant.hasPhoto && participant.photoUrl ? (
                        <img src={participant.photoUrl} alt={`${participant.fullName} official photo`} className="mt-3 aspect-square w-32 rounded-xl object-cover" />
                      ) : (
                        <div className="mt-3">
                          <OfficialMemberPhotoCapture
                            applicationMemberId={participant.id}
                            source={participant.existingMemberId ? "renewal" : undefined}
                            staffName={application.staffName}
                            onSaved={() => void load()}
                          />
                        </div>
                      )}

                      {participant.existingMemberId ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl bg-zinc-50 p-3 text-sm">
                            <p className="font-bold">Current card</p>
                            <p className="mt-1 font-mono text-zinc-700">{participant.currentBarcode || "No active credential registered yet"}</p>
                          </div>
                          {participant.cardVerified && (
                            <div className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">
                              {participant.renewalCardAction === "keep"
                                ? `Verified — keep ${participant.scannedBarcode}`
                                : `Verified — replace with ${participant.reservedBarcode || participant.scannedBarcode}`}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              inputMode="text"
                              value={barcodes[participant.id] || ""}
                              onChange={(event) => setBarcodes((current) => ({ ...current, [participant.id]: event.target.value }))}
                              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void processCard(application, participant); } }}
                              placeholder="SCAN MEMBERSHIP CARD"
                              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 font-mono"
                            />
                            <button type="button" onClick={() => void processCard(application, participant)} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Verify Card</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          {participant.reservedBarcode ? (
                            <div className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">Card reserved: {participant.reservedBarcode}</div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                inputMode="text"
                                value={barcodes[participant.id] || ""}
                                onChange={(event) => setBarcodes((current) => ({ ...current, [participant.id]: event.target.value }))}
                                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void processCard(application, participant); } }}
                                placeholder="Scan card barcode"
                                className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 font-mono"
                              />
                              <button type="button" onClick={() => void processCard(application, participant)} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Reserve Card</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {openId === application.id && (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-black">Payment</p>
                  <p className="mt-1 text-xs text-zinc-500">Rates and discount values are controlled by Super Admin. Staff can only enter an issued Discount code.</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-3"><p className="text-[11px] font-black uppercase text-zinc-400">Base Price</p><p className="mt-1 font-black">€{(((discountPreviews[application.id]?.basePriceCents ?? application.basePriceCents ?? 0) / 100)).toFixed(2)}</p></div>
                    <div className="rounded-xl bg-white p-3"><p className="text-[11px] font-black uppercase text-zinc-400">Discount</p><p className="mt-1 font-black">{discountPreviews[application.id] ? `${discountPreviews[application.id].percentage}%` : "No discount"}</p></div>
                    <div className="rounded-xl bg-white p-3"><p className="text-[11px] font-black uppercase text-zinc-400">Final Total</p><p className="mt-1 font-black">€{(((discountPreviews[application.id]?.finalAmountCents ?? application.basePriceCents ?? 0) / 100)).toFixed(2)}</p></div>
                  </div>

                  <label className="mt-4 block text-sm font-bold">
                    Discount code
                    <div className="mt-2 flex gap-2">
                      <input
                        value={discountCodes[application.id] || ""}
                        onChange={(event) => {
                          setDiscountCodes((current) => ({ ...current, [application.id]: event.target.value.toUpperCase() }));
                          setDiscountPreviews((current) => {
                            const next = { ...current };
                            delete next[application.id];
                            return next;
                          });
                        }}
                        placeholder="Enter Super Admin code"
                        className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono uppercase"
                      />
                      <button type="button" onClick={() => void applyDiscountCode(application)} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-black text-white">Apply code</button>
                    </div>
                  </label>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(["cash", "card", "other"] as const).map((method) => (
                      <label key={method} className="rounded-xl border border-zinc-300 bg-white p-3 text-center text-sm font-black">
                        <input type="radio" name={`payment-${application.id}`} checked={paymentMethods[application.id] === method} onChange={() => setPaymentMethods((current) => ({ ...current, [application.id]: method }))} className="mr-2" />
                        {method === "cash" ? "Cash" : method === "card" ? "Card" : "Other"}
                      </label>
                    ))}
                  </div>

                  {paymentMethods[application.id] === "other" && (
                    <input value={paymentOtherTexts[application.id] || ""} onChange={(event) => setPaymentOtherTexts((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Describe Other payment method" className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2" />
                  )}

                  <label className="mt-4 block text-sm font-bold">
                    Payment Staff Name
                    <input
                      value={activationStaffNames[application.id] || ""}
                      onChange={(event) => setActivationStaffNames((current) => ({ ...current, [application.id]: event.target.value }))}
                      placeholder="Staff member receiving payment"
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
                    />
                  </label>
                  {!readyToActivate && (
                    <p className="mt-3 text-sm font-semibold text-amber-700">
                      Complete every participant verification and card action before activation. A missing photo does not block activation.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={
                      activatingId === application.id ||
                      !readyToActivate ||
                      !(activationStaffNames[application.id] || "").trim() ||
                      !paymentMethods[application.id] ||
                      (paymentMethods[application.id] === "other" && !(paymentOtherTexts[application.id] || "").trim()) ||
                      Boolean((discountCodes[application.id] || "").trim() && !discountPreviews[application.id])
                    }
                    onClick={() => void activateApplication(application)}
                    className="mt-4 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {activatingId === application.id ? "Activating…" : "PAYMENT RECEIVED — ACTIVATE"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
