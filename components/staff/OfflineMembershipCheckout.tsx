"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { RegistrationDraft } from "@/lib/membershipRegistrationTypes";
import {
  buildOfflineReference,
  enqueueOfflineMembership,
  type OfflineEnrollmentContext,
  type OfflineMembershipPayment,
  type OfflineMembershipRecord,
} from "@/lib/offlineMembershipQueue";

type Props = {
  draft: RegistrationDraft;
  context: OfflineEnrollmentContext;
  onSaved?: (record: OfflineMembershipRecord) => void;
  onCancel?: () => void;
};

function formatEur(amountCents: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function selectedAmount(draft: RegistrationDraft, context: OfflineEnrollmentContext) {
  return (
    context.config.pricing.entries.find(
      (entry) =>
        entry.membershipType === draft.membershipType &&
        entry.durationKey === draft.durationKey &&
        entry.isActive !== false,
    )?.amountCents ?? null
  );
}

export default function OfflineMembershipCheckout({ draft, context, onSaved, onCancel }: Props) {
  const participantCount = draft.participants.length;
  const amountCents = useMemo(() => selectedAmount(draft, context), [draft, context]);
  const [paymentMethod, setPaymentMethod] = useState<OfflineMembershipPayment["method"]>("cash");
  const [paymentOther, setPaymentOther] = useState("");
  const [cardValues, setCardValues] = useState<string[]>(() => Array.from({ length: participantCount }, () => ""));
  const [idVerified, setIdVerified] = useState<boolean[]>(() => Array.from({ length: participantCount }, () => false));
  const [studentVerified, setStudentVerified] = useState<boolean[]>(() => Array.from({ length: participantCount }, () => false));
  const [guardianPresent, setGuardianPresent] = useState<boolean[]>(() => Array.from({ length: participantCount }, () => false));
  const [guardianCosign, setGuardianCosign] = useState<boolean[]>(() => Array.from({ length: participantCount }, () => false));
  const [sameAddressVerified, setSameAddressVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<OfflineMembershipRecord | null>(null);

  function setBooleanAt(setter: React.Dispatch<React.SetStateAction<boolean[]>>, index: number, value: boolean) {
    setter((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function setCardAt(index: number, value: string) {
    setCardValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function validate() {
    if (amountCents == null) return "The cached membership price is unavailable. Reconnect before enrolling this member.";
    if (!context.systemUser.displayName.trim()) return "Staff identity is missing from the cached enrollment settings.";
    if (paymentMethod === "other" && !paymentOther.trim()) return "Describe the payment method used.";
    if (cardValues.some((value) => !value.trim())) return "Scan or enter the physical card for every member.";
    const normalizedCards = cardValues.map((value) => value.trim().toUpperCase());
    if (new Set(normalizedCards).size !== normalizedCards.length) return "Each member must receive a different physical card.";
    if (idVerified.some((value) => !value)) return "Confirm that ID has been verified for every member.";
    if (draft.membershipType === "student" && studentVerified.some((value) => !value)) {
      return "Confirm the student eligibility document before saving offline.";
    }
    if (draft.membershipType === "couples" && !sameAddressVerified) {
      return "Confirm the same-address evidence before saving the Couples membership offline.";
    }
    for (let index = 0; index < participantCount; index += 1) {
      if (!draft.participants[index]?.guardian) continue;
      if (!guardianPresent[index] || !guardianCosign[index]) {
        return `Applicant ${index + 1}: confirm guardian presence and co-signature.`;
      }
    }
    return "";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (!crypto?.randomUUID) throw new Error("This device cannot create a secure offline reference.");
      const clientSubmissionId = crypto.randomUUID();
      const offlineReference = buildOfflineReference(clientSubmissionId);
      const soldAt = new Date().toISOString();
      const { photos, ...registration } = draft;
      const record: OfflineMembershipRecord = {
        clientSubmissionId,
        offlineReference,
        gymId: context.gymId,
        soldAt,
        cachedContext: context,
        registration,
        pendingCardValues: cardValues.map((value) => value.trim()),
        payment: {
          method: paymentMethod,
          ...(paymentMethod === "other" ? { otherText: paymentOther.trim() } : {}),
          amountCents: amountCents!,
          currency: "EUR",
          staffName: context.systemUser.displayName.trim(),
        },
        verifications: {
          participantIdVerified: [...idVerified],
          studentEligibilityVerified:
            draft.membershipType === "student"
              ? [...studentVerified]
              : Array.from({ length: participantCount }, () => false),
          sameAddressVerified: draft.membershipType === "couples" ? sameAddressVerified : false,
          guardianPresentVerified: [...guardianPresent],
          guardianCosignVerified: [...guardianCosign],
        },
        photos: photos.map((photo) =>
          photo ? photo.slice(0, photo.size, photo.type || "image/webp") : null,
        ),
        state: "queued",
      };

      await enqueueOfflineMembership(record);
      setSaved(record);
      onSaved?.(record);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the membership offline.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-emerald-50 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
          PENDING ONLINE ACTIVATION
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Membership saved offline — member may train immediately.
        </h2>
        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
          <p><span className="font-bold">Temporary OFFLINE- reference:</span> {saved.offlineReference}</p>
          <p><span className="font-bold">Amount:</span> {formatEur(saved.payment.amountCents)}</p>
          <p><span className="font-bold">Payment:</span> {saved.payment.method === "other" ? saved.payment.otherText : saved.payment.method}</p>
          <p><span className="font-bold">Sale time:</span> {new Date(saved.soldAt).toLocaleString("en-GB")}</p>
        </div>
        <div className="mt-4 space-y-2 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          {saved.pendingCardValues.map((card, index) => (
            <p key={`${card}-${index}`}><span className="font-bold">Physical card {index + 1}:</span> {card} — PENDING CONFIRMATION</p>
          ))}
          <p className="font-bold">No permanent BGM member number has been issued yet.</p>
          <p>The system will synchronize this sale automatically when the internet connection returns.</p>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={save} className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-5 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">OFFLINE CHECKOUT</p>
      <h2 className="mt-2 text-2xl font-black text-white">Complete payment and issue the physical card</h2>
      <p className="mt-2 text-sm leading-6 text-amber-100">
        This sale will be stored on this reception terminal and synchronized automatically when the connection returns.
      </p>

      <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-bold text-white" htmlFor="offline-payment-method">Payment method</label>
          <select
            id="offline-payment-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as OfflineMembershipPayment["method"])}
            className="mt-2 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-white"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Amount</p>
          <p className="mt-2 rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-lg font-black text-white">
            {amountCents == null ? "Unavailable" : formatEur(amountCents)}
          </p>
        </div>
        {paymentMethod === "other" ? (
          <div className="sm:col-span-2">
            <label className="text-sm font-bold text-white" htmlFor="offline-payment-other">Payment details</label>
            <input id="offline-payment-other" value={paymentOther} onChange={(event) => setPaymentOther(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-white" />
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        {draft.participants.map((participant, index) => (
          <section key={`${participant.idNumber}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-black text-white">{participant.firstName} {participant.lastName}</h3>
            <label className="mt-4 block text-sm font-bold text-white" htmlFor={`offline-card-${index}`}>Physical card</label>
            <input
              id={`offline-card-${index}`}
              value={cardValues[index] || ""}
              onChange={(event) => setCardAt(index, event.target.value)}
              autoComplete="off"
              placeholder="Scan or enter physical card"
              className="mt-2 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-white"
            />
            <p className="mt-1 text-xs text-amber-200">Card will be marked PENDING CONFIRMATION until central sync.</p>

            <label className="mt-4 flex items-start gap-3 text-sm text-white">
              <input type="checkbox" checked={idVerified[index] || false} onChange={(event) => setBooleanAt(setIdVerified, index, event.target.checked)} className="mt-1" />
              <span>ID card/passport verified by staff.</span>
            </label>
            {draft.membershipType === "student" ? (
              <label className="mt-3 flex items-start gap-3 text-sm text-white">
                <input type="checkbox" checked={studentVerified[index] || false} onChange={(event) => setBooleanAt(setStudentVerified, index, event.target.checked)} className="mt-1" />
                <span>Student eligibility document verified.</span>
              </label>
            ) : null}
            {participant.guardian ? (
              <>
                <label className="mt-3 flex items-start gap-3 text-sm text-white">
                  <input type="checkbox" checked={guardianPresent[index] || false} onChange={(event) => setBooleanAt(setGuardianPresent, index, event.target.checked)} className="mt-1" />
                  <span>Parent/legal guardian present and verified.</span>
                </label>
                <label className="mt-3 flex items-start gap-3 text-sm text-white">
                  <input type="checkbox" checked={guardianCosign[index] || false} onChange={(event) => setBooleanAt(setGuardianCosign, index, event.target.checked)} className="mt-1" />
                  <span>Guardian co-signature completed.</span>
                </label>
              </>
            ) : null}
          </section>
        ))}
      </div>

      {draft.membershipType === "couples" ? (
        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white">
          <input type="checkbox" checked={sameAddressVerified} onChange={(event) => setSameAddressVerified(event.target.checked)} className="mt-1" />
          <span>Same-address evidence verified for both Couples applicants.</span>
        </label>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300/25 bg-red-500/15 p-3 text-sm font-bold text-red-100">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="rounded-xl bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save Offline"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            Back to form
          </button>
        ) : null}
      </div>
    </form>
  );
}
