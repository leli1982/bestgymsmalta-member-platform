"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Barcode,
  ContactRound,
  CreditCard,
  HeartHandshake,
  Loader2,
  Printer,
  Save,
  UserRound,
  X,
} from "lucide-react";

type Participant = {
  id: string;
  participantOrder: number;
  existingMemberId: string | null;
  matchedMemberId: string | null;
  identityMatchState: string;
  duplicateContactWarning: boolean;
  under18AtSubmission: boolean;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  guardianName: string;
  guardianIdNumber: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  idVerified: boolean;
  studentEligibilityVerified: boolean;
  guardianPresentVerified: boolean;
  guardianCosignVerified: boolean;
  hasPhoto: boolean;
  photoUrl: string | null;
  applicationPhotoUrl: string | null;
  matchedMemberPhotoUrl: string | null;
  matchedMemberNumber: string | null;
  matchedMemberName: string | null;
  matchedMemberStatus: string | null;
  matchedMembershipExpiry: string | null;
  reservedBarcode: string | null;
  currentBarcode: string | null;
  cardVerified: boolean;
  renewalCardAction: string | null;
  scannedBarcode: string | null;
};

type Application = {
  id: string;
  reference: string;
  kind: "new" | "renewal";
  status: string;
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  enrollmentGymId: string;
  enrollmentGymName: string;
  submittedAt: string | null;
  paymentReceivedAt: string | null;
  activatedAt: string | null;
  basePriceCents: number | null;
  currency: string;
  priceCatalogVersionId: string | null;
  declarationSnapshot: unknown;
  sameAddressVerified: boolean;
  participants: Participant[];
};

type Props = {
  applicationId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

const DURATION_OPTIONS = [
  ["1_week", "1 week"],
  ["2_weeks", "2 weeks"],
  ["1_month", "1 month"],
  ["3_months", "3 months"],
  ["6_months", "6 months"],
  ["1_year", "1 year"],
];

function editableSnapshot(application: Application) {
  return {
    action: "save_review",
    membershipType: application.membershipType,
    durationKey: application.durationKey,
    startDate: application.startDate,
    expiryDate: application.expiryDate,
    sameAddressVerified: application.sameAddressVerified,
    participants: application.participants.map((participant) => ({
      id: participant.id,
      participantOrder: participant.participantOrder,
      firstName: participant.firstName,
      lastName: participant.lastName,
      addressLine1: participant.addressLine1,
      addressLine2: participant.addressLine2,
      postcode: participant.postcode,
      idNumber: participant.idNumber,
      dateOfBirth: participant.dateOfBirth,
      phone: participant.phone,
      email: participant.email,
      nextOfKin: participant.nextOfKin,
      idVerified: participant.idVerified,
      studentEligibilityVerified: participant.studentEligibilityVerified,
      guardianPresentVerified: participant.guardianPresentVerified,
      guardianCosignVerified: participant.guardianCosignVerified,
    })),
  };
}

function formatMalta(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(cents: number | null, currency: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: currency || "EUR",
  }).format(cents / 100);
}

function declarationEntries(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  return Object.entries(snapshot as Record<string, unknown>).map(([key, value]) => {
    const item =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return {
      key,
      versionNo: String(item.versionNo ?? "—"),
      body: String(item.body ?? ""),
    };
  });
}

export default function StaffMembershipReviewModal({
  applicationId,
  onClose,
  onChanged,
}: Props) {
  const [application, setApplication] = useState<Application | null>(null);
  const [form, setForm] = useState<ReturnType<typeof editableSnapshot> | null>(null);
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [scanParticipantId, setScanParticipantId] = useState<string | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [paymentPrompt, setPaymentPrompt] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other" | "">("");
  const [paymentOtherText, setPaymentOtherText] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<{
    code: string;
    percentage: number;
    basePriceCents: number;
    discountAmountCents: number;
    finalAmountCents: number;
    currency: string;
  } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeConfirmation, setActiveConfirmation] = useState<{ activatedAt: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async () => {
    const response = await fetch(
      `/api/system/members/applications/${encodeURIComponent(applicationId)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Could not load membership application.");
    }
    const next = data.application as Application;
    const snapshot = editableSnapshot(next);
    setApplication(next);
    setForm(snapshot);
    setOriginal(JSON.stringify(snapshot));
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDetail()
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load membership application."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  useEffect(() => {
    if (scanParticipantId) barcodeRef.current?.focus();
  }, [scanParticipantId, manualEntry]);

  const dirty = Boolean(form && original && JSON.stringify(form) !== original);

  const allReady = useMemo(() => {
    if (!application || !form) return false;
    const participantReady = application.participants.every((participant, index) => {
      const fields = form.participants[index];
      if (!fields?.firstName.trim() || !fields.lastName.trim()) return false;
      if (!fields.idVerified) return false;
      if (form.membershipType === "student" && !fields.studentEligibilityVerified) {
        return false;
      }
      if (
        participant.under18AtSubmission &&
        (!fields.guardianPresentVerified || !fields.guardianCosignVerified)
      ) {
        return false;
      }
      const cardReady = participant.existingMemberId
        ? participant.cardVerified
        : Boolean(participant.reservedBarcode);
      return cardReady;
    });

    return (
      participantReady &&
      (form.membershipType !== "couples" || form.sameAddressVerified)
    );
  }, [application, form]);

  function updateApplicationField(
    field: "membershipType" | "durationKey" | "startDate" | "expiryDate",
    value: string
  ) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateParticipant(
    index: number,
    field: keyof ReturnType<typeof editableSnapshot>["participants"][number],
    value: string | boolean
  ) {
    if (field === "id" || field === "participantOrder") return;
    setForm((current) => {
      if (!current) return current;
      const participants = [...current.participants];
      participants[index] = { ...participants[index], [field]: value };
      return { ...current, participants };
    });
  }

  async function saveReviewIfDirty() {
    if (!form || !dirty) return true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, action: "save_review" }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save membership review.");
      await loadDetail();
      await onChanged();
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save membership review."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (acting || saving) return;
    if (!(await saveReviewIfDirty())) return;
    onClose();
  }

  async function reuseExistingMember(applicationMemberId: string) {
    if (!(await saveReviewIfDirty())) return;
    setActing(true);
    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reuse_existing_member",
            applicationMemberId,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not confirm renewal.");
      await loadDetail();
      await onChanged();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not confirm renewal."
      );
    } finally {
      setActing(false);
    }
  }

  async function rejectApplication() {
    if (!rejectReason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setActing(true);
    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject_application",
            reason: rejectReason.trim(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reject application.");
      await onChanged();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reject application."
      );
    } finally {
      setActing(false);
    }
  }

  function openScan(participantId?: string) {
    if (!application) return;
    const target =
      participantId ||
      application.participants.find((participant) =>
        participant.existingMemberId
          ? !participant.cardVerified
          : !participant.reservedBarcode
      )?.id ||
      application.participants[0]?.id;
    setScanParticipantId(target || null);
    setBarcodeValue("");
    setManualEntry(false);
    setError("");
  }

  async function submitCard(event?: React.FormEvent) {
    event?.preventDefault();
    if (!scanParticipantId || !barcodeValue.trim()) return;
    if (!(await saveReviewIfDirty())) return;
    setActing(true);
    setError("");
    try {
      const response = await fetch("/api/system/members/card/assign", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationMemberId: scanParticipantId,
          barcode: barcodeValue.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            data.error || "Card conflict: that card is already assigned or reserved."
          );
        }
        throw new Error(data.error || "Could not assign card.");
      }
      await loadDetail();
      await onChanged();
      setBarcodeValue("");
      setScanParticipantId(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not assign card."
      );
    } finally {
      setActing(false);
    }
  }

  async function openPrint() {
    if (!(await saveReviewIfDirty())) return;
    window.open(
      `/staff/applications/${encodeURIComponent(applicationId)}/print`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function applyDiscountCode() {
    if (!discountCode.trim()) {
      setDiscountPreview(null);
      setError("");
      return;
    }
    if (!(await saveReviewIfDirty())) return;
    setActing(true);
    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(applicationId)}/discount`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: discountCode.trim() }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Discount code is unavailable.");
      setDiscountCode(data.code || discountCode.trim().toUpperCase());
      setDiscountPreview(data);
    } catch (requestError) {
      setDiscountPreview(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not validate the discount code."
      );
    } finally {
      setActing(false);
    }
  }

  async function activateMembership(event: React.FormEvent) {
    event.preventDefault();
    if (!allReady || !staffName.trim() || !paymentMethod) return;
    if (paymentMethod === "other" && !paymentOtherText.trim()) return;
    if (discountCode.trim() && !discountPreview) {
      setError("Apply the discount code before confirming payment.");
      return;
    }
    if (!(await saveReviewIfDirty())) return;
    setActing(true);
    setError("");
    try {
      const response = await fetch("/api/system/members/enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          applicationId,
          paymentMethod,
          paymentOtherText: paymentMethod === "other" ? paymentOtherText.trim() : "",
          staffName: staffName.trim(),
          discountCode: discountCode.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not activate membership.");
      const activatedAt = new Date().toISOString();
      setActiveConfirmation({ activatedAt });
      setPaymentPrompt(false);
      await onChanged();
      window.setTimeout(() => onClose(), 1800);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not activate membership."
      );
    } finally {
      setActing(false);
    }
  }

  if (activeConfirmation) {
    const primary = application?.participants[0];
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <BadgeCheck className="h-11 w-11" />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
            Payment received
          </p>
          <h2 className="mt-2 text-3xl font-black text-zinc-950">MEMBERSHIP ACTIVE</h2>
          <p className="mt-3 text-lg font-bold text-zinc-700">
            {primary
              ? `${primary.firstName} ${primary.lastName}`
              : application?.reference}
          </p>
          <p className="mt-4 text-sm font-semibold text-zinc-500">
            {formatMalta(activeConfirmation.activatedAt)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[96vh] w-full overflow-auto rounded-t-3xl bg-[#f6f6f6] shadow-2xl sm:max-w-5xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-[#ff5a0a]">
              {application?.reference || "Membership application"}
            </p>
            <h2 className="truncate text-xl font-black text-zinc-950">
              Review membership
            </h2>
            {application && (
              <p className="mt-0.5 text-xs font-semibold text-zinc-400">
                Submitted {formatMalta(application.submittedAt)} ·{" "}
                {application.enrollmentGymName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void requestClose()}
            className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-500 hover:bg-zinc-50"
            aria-label="Close review"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading && (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5a0a]" />
          </div>
        )}
        {!loading && error && (
          <div className="mx-5 mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 sm:mx-6">
            {error}
          </div>
        )}

        {!loading && application && form && (
          <div className="space-y-5 p-5 sm:p-6">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Summary label="Historical base price" value={formatMoney(application.basePriceCents, application.currency)} />
                <Summary label="Membership" value={`${application.membershipType} · ${application.durationKey.replaceAll("_", " ")}`} />
                <Summary label="Dates" value={`${application.startDate} → ${application.expiryDate}`} />
              </div>
              {declarationEntries(application.declarationSnapshot).length > 0 && (
                <details className="mt-4 rounded-2xl bg-zinc-50 p-4">
                  <summary className="cursor-pointer text-sm font-black text-zinc-800">
                    Historical declaration versions
                  </summary>
                  <div className="mt-3 space-y-3">
                    {declarationEntries(application.declarationSnapshot).map((item) => (
                      <div key={item.key} className="text-sm text-zinc-600">
                        <p className="font-black capitalize text-zinc-800">
                          {item.key.replaceAll("_", " ")} · version {item.versionNo}
                        </p>
                        {item.body && <p className="mt-1 whitespace-pre-wrap">{item.body}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>

            {form.participants.map((participantForm, index) => {
              const participant = application.participants[index];
              const reusesExistingMember = Boolean(participant?.existingMemberId);
              const possibleRenewal =
                participant?.identityMatchState === "expired_inactive" &&
                Boolean(participant.matchedMemberId) &&
                !reusesExistingMember;
              const cardReady = reusesExistingMember
                ? Boolean(participant?.cardVerified)
                : Boolean(participant?.reservedBarcode);

              return (
                <section
                  key={participantForm.id}
                  className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  {possibleRenewal && (
                    <div className="mb-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                        EXISTING MEMBER FOUND — POSSIBLE RENEWAL
                      </p>
                      <p className="mt-2 font-black text-zinc-950">
                        {participant.matchedMemberName || "Existing member"}{" "}
                        {participant.matchedMemberNumber
                          ? `· ${participant.matchedMemberNumber}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        Status: {participant.matchedMemberStatus || "unknown"} · Expiry:{" "}
                        {participant.matchedMembershipExpiry || "—"}
                      </p>
                      <button
                        type="button"
                        disabled={acting || saving}
                        onClick={() => void reuseExistingMember(participant.id)}
                        className="mt-4 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
                      >
                        Renew Existing Member
                      </button>
                    </div>
                  )}

                  {reusesExistingMember && (
                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                      Existing member reuse confirmed. This participant will renew the matched
                      member rather than create a duplicate record.
                    </div>
                  )}

                  {participant?.duplicateContactWarning && (
                    <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold text-orange-800">
                      Duplicate contact warning: this phone number or email is already used by
                      another member. Verify identity before continuing.
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {participant?.photoUrl ? (
                        <img
                          src={participant.photoUrl}
                          alt=""
                          className="h-24 w-24 rounded-3xl bg-zinc-100 object-cover"
                        />
                      ) : (
                        <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-orange-50 text-orange-400">
                          <UserRound className="h-9 w-9" />
                        </span>
                      )}
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">
                          Participant {index + 1}
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-zinc-950">
                          {participantForm.firstName} {participantForm.lastName}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              participant?.hasPhoto
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {participant?.hasPhoto ? "PHOTO ✓" : "PHOTO LATER"}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-black ${
                              cardReady
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {cardReady ? "CARD ASSIGNED ✓" : "CARD REQUIRED"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {cardReady && (
                      <p className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-black text-white">
                        {participant.reservedBarcode ||
                          participant.scannedBarcode ||
                          participant.currentBarcode}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500">
                        <ContactRound className="h-4 w-4" /> Personal
                      </h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="First name" value={participantForm.firstName} onChange={(value) => updateParticipant(index, "firstName", value)} />
                        <Field label="Surname" value={participantForm.lastName} onChange={(value) => updateParticipant(index, "lastName", value)} />
                        <Field label="ID number" value={participantForm.idNumber} onChange={(value) => updateParticipant(index, "idNumber", value)} />
                        <Field label="Date of birth" type="date" value={participantForm.dateOfBirth} onChange={(value) => updateParticipant(index, "dateOfBirth", value)} />
                      </div>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500">
                        <UserRound className="h-4 w-4" /> Contact
                      </h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Phone" value={participantForm.phone} onChange={(value) => updateParticipant(index, "phone", value)} />
                        <Field label="Email" value={participantForm.email} onChange={(value) => updateParticipant(index, "email", value)} />
                        <Field label="Address" value={participantForm.addressLine1} onChange={(value) => updateParticipant(index, "addressLine1", value)} />
                        <Field label="Address line 2" value={participantForm.addressLine2} onChange={(value) => updateParticipant(index, "addressLine2", value)} />
                        <Field label="Postcode" value={participantForm.postcode} onChange={(value) => updateParticipant(index, "postcode", value)} />
                        <Field label="Next of kin" value={participantForm.nextOfKin} onChange={(value) => updateParticipant(index, "nextOfKin", value)} />
                      </div>
                      {participant.town && (
                        <p className="mt-3 text-sm font-semibold text-zinc-500">
                          Town: {participant.town}
                        </p>
                      )}
                    </div>
                  </div>

                  {participant.under18AtSubmission && (
                    <div className="mt-5 rounded-2xl bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-violet-700">
                        Guardian on application
                      </p>
                      <p className="mt-2 text-sm font-bold text-zinc-800">
                        {participant.guardianName || "—"} · {participant.guardianRelationship || "—"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        ID {participant.guardianIdNumber || "—"} · {participant.guardianPhone || "—"} · {participant.guardianEmail || "—"}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Reception verification
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Check
                        label="ID / passport verified"
                        checked={participantForm.idVerified}
                        onChange={(checked) => updateParticipant(index, "idVerified", checked)}
                      />
                      {application.membershipType === "student" && (
                        <Check
                          label="Student eligibility verified"
                          checked={participantForm.studentEligibilityVerified}
                          onChange={(checked) =>
                            updateParticipant(index, "studentEligibilityVerified", checked)
                          }
                        />
                      )}
                      {participant.under18AtSubmission && (
                        <>
                          <Check
                            label="Guardian present verified"
                            checked={participantForm.guardianPresentVerified}
                            onChange={(checked) =>
                              updateParticipant(index, "guardianPresentVerified", checked)
                            }
                          />
                          <Check
                            label="Guardian co-sign verified"
                            checked={participantForm.guardianCosignVerified}
                            onChange={(checked) =>
                              updateParticipant(index, "guardianCosignVerified", checked)
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openScan(participant.id)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black text-zinc-700"
                  >
                    <Barcode className="h-4 w-4" />{" "}
                    {cardReady
                      ? "Verify / change card"
                      : reusesExistingMember
                        ? "Verify membership card"
                        : "Assign this card"}
                  </button>
                </section>
              );
            })}

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500">
                <HeartHandshake className="h-4 w-4" /> Membership
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-black uppercase tracking-wide text-zinc-400">
                  Type
                  <select
                    value={form.membershipType}
                    onChange={(event) => updateApplicationField("membershipType", event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900"
                  >
                    <option value="single">Single</option>
                    <option value="couples">Couples</option>
                    <option value="student">Student</option>
                  </select>
                </label>
                <label className="text-xs font-black uppercase tracking-wide text-zinc-400">
                  Duration
                  <select
                    value={form.durationKey}
                    onChange={(event) => updateApplicationField("durationKey", event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900"
                  >
                    {DURATION_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <Field label="Start date" type="date" value={form.startDate} onChange={(value) => updateApplicationField("startDate", value)} />
                <Field label="Expiry date" type="date" value={form.expiryDate} onChange={(value) => updateApplicationField("expiryDate", value)} />
              </div>
              {form.membershipType === "couples" && (
                <div className="mt-4">
                  <Check
                    label="Same-address evidence verified"
                    checked={form.sameAddressVerified}
                    onChange={(checked) =>
                      setForm((current) =>
                        current ? { ...current, sameAddressVerified: checked } : current
                      )
                    }
                  />
                </div>
              )}
            </section>

            {scanParticipantId && (
              <section className="rounded-3xl border-2 border-orange-300 bg-orange-50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
                      Scan Card
                    </p>
                    <h3 className="mt-1 text-xl font-black text-zinc-950">
                      Scan the physical card now
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanParticipantId(null)}
                    className="rounded-xl p-2 text-zinc-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={submitCard} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    ref={barcodeRef}
                    value={barcodeValue}
                    onChange={(event) => setBarcodeValue(event.target.value)}
                    placeholder={manualEntry ? "Enter card barcode manually" : "Scanner input"}
                    className="min-w-0 flex-1 rounded-2xl border border-orange-300 bg-white px-4 py-3 text-lg font-black outline-none focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    disabled={acting || !barcodeValue.trim()}
                    className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                  >
                    Confirm card
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setManualEntry(true);
                    window.setTimeout(() => barcodeRef.current?.focus(), 0);
                  }}
                  className="mt-3 text-sm font-bold text-orange-700 underline underline-offset-4"
                >
                  Scanner not working? Enter card manually
                </button>
              </section>
            )}

            {rejectOpen && (
              <section className="rounded-3xl border-2 border-red-300 bg-red-50 p-5 sm:p-6">
                <h3 className="text-xl font-black text-zinc-950">Reject Application</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  A reason is mandatory and will be saved in the audit trail. Any reserved
                  cards for this application will be released.
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={3}
                  placeholder="Reason for rejection"
                  className="mt-4 w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-red-100"
                />
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => void rejectApplication()}
                    disabled={acting || !rejectReason.trim()}
                    className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectOpen(false)}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-black text-red-700"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {paymentPrompt && (
              <section className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 sm:p-6">
                <h3 className="text-xl font-black text-zinc-950">Confirm payment received</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Membership rates and discount values are controlled by Super Admin. Staff can only enter an issued discount code.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Summary
                    label="Base Price"
                    value={formatMoney(
                      discountPreview?.basePriceCents ?? application.basePriceCents,
                      discountPreview?.currency ?? application.currency
                    )}
                  />
                  <Summary
                    label="Discount"
                    value={discountPreview
                      ? `${discountPreview.percentage}% · -${formatMoney(discountPreview.discountAmountCents, discountPreview.currency)}`
                      : "No discount"}
                  />
                  <Summary
                    label="Final Total"
                    value={formatMoney(
                      discountPreview?.finalAmountCents ?? application.basePriceCents,
                      discountPreview?.currency ?? application.currency
                    )}
                  />
                </div>

                <div className="mt-4">
                  <label className="text-xs font-black uppercase tracking-wide text-emerald-800">
                    Discount code
                    <div className="mt-1.5 flex gap-2">
                      <input
                        value={discountCode}
                        onChange={(event) => {
                          setDiscountCode(event.target.value.toUpperCase());
                          setDiscountPreview(null);
                        }}
                        placeholder="Enter Super Admin code"
                        className="min-w-0 flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 font-mono font-bold uppercase outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void applyDiscountCode()}
                        disabled={acting || !discountCode.trim()}
                        className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
                      >
                        Apply code
                      </button>
                    </div>
                  </label>
                </div>

                <form onSubmit={activateMembership} className="mt-4 space-y-4">
                  <fieldset>
                    <legend className="text-xs font-black uppercase tracking-wide text-emerald-800">Payment method</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["cash", "card", "other"] as const).map((method) => (
                        <label key={method} className="cursor-pointer rounded-xl border border-emerald-300 bg-white px-3 py-3 text-center text-sm font-black capitalize">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method}
                            checked={paymentMethod === method}
                            onChange={() => setPaymentMethod(method)}
                            className="mr-2 accent-emerald-700"
                          />
                          {method === "cash" ? "Cash" : method === "card" ? "Card" : "Other"}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {paymentMethod === "other" && (
                    <input
                      value={paymentOtherText}
                      onChange={(event) => setPaymentOtherText(event.target.value)}
                      placeholder="Describe Other payment method"
                      className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 font-bold outline-none"
                    />
                  )}

                  <input
                    value={staffName}
                    onChange={(event) => setStaffName(event.target.value)}
                    placeholder="Payment Staff Name"
                    className="w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-100"
                  />

                  <button
                    disabled={
                      acting ||
                      !staffName.trim() ||
                      !paymentMethod ||
                      (paymentMethod === "other" && !paymentOtherText.trim()) ||
                      Boolean(discountCode.trim() && !discountPreview)
                    }
                    className="w-full rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                  >
                    {acting ? "Activating…" : "PAYMENT RECEIVED — ACTIVATE"}
                  </button>
                </form>
              </section>
            )}

            <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:p-5">
              {dirty && (
                <p className="mb-3 flex items-center gap-2 text-xs font-bold text-orange-700">
                  <Save className="h-4 w-4" /> Corrections and verification will be saved
                  before the next action.
                </p>
              )}
              {!allReady && (
                <p className="mb-3 text-xs font-bold text-amber-700">
                  Complete the required verification and card action for every participant
                  before activation. A missing photo does not block activation.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => openScan()}
                  disabled={acting || saving}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  <Barcode className="h-5 w-5" /> SCAN CARD
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentPrompt(true)}
                  disabled={!allReady || acting || saving}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <CreditCard className="h-5 w-5" /> PAYMENT RECEIVED
                </button>
                <button
                  type="button"
                  onClick={() => void openPrint()}
                  disabled={acting || saving}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-zinc-950 bg-white px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-40"
                >
                  <Printer className="h-5 w-5" /> PRINT FORM
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  disabled={acting || saving}
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-40"
                >
                  Reject Application
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-zinc-400">
      {label}
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900 outline-none focus:border-[#ff5a0a] focus:ring-3 focus:ring-orange-100"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold text-zinc-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[#ff5a0a]"
      />
      {label}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-black text-zinc-900">{value}</p>
    </div>
  );
}
