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
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  idNumber: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nextOfKin: string;
  hasPhoto: boolean;
  photoUrl: string | null;
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
    membershipType: application.membershipType,
    durationKey: application.durationKey,
    startDate: application.startDate,
    expiryDate: application.expiryDate,
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

export default function StaffMembershipReviewModal({ applicationId, onClose, onChanged }: Props) {
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
  const [activationStaffName, setActivationStaffName] = useState("");
  const [activeConfirmation, setActiveConfirmation] = useState<{ activatedAt: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async () => {
    const response = await fetch(`/api/system/members/applications/${encodeURIComponent(applicationId)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load membership application.");
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
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not load membership application.");
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
    return application.participants.every((participant, index) => {
      const fields = form.participants[index];
      const identityReady = Boolean(fields?.firstName.trim() && fields?.lastName.trim());
      const cardReady = application.kind === "new" ? Boolean(participant.reservedBarcode) : participant.cardVerified;
      return identityReady && participant.hasPhoto && cardReady;
    });
  }, [application, form]);

  function updateApplicationField(field: "membershipType" | "durationKey" | "startDate" | "expiryDate", value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateParticipant(index: number, field: keyof ReturnType<typeof editableSnapshot>["participants"][number], value: string) {
    if (field === "id" || field === "participantOrder") return;
    setForm((current) => {
      if (!current) return current;
      const participants = [...current.participants];
      participants[index] = { ...participants[index], [field]: value };
      return { ...current, participants };
    });
  }

  async function saveCorrectionsIfDirty() {
    if (!form || !dirty) return true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/system/members/applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save corrections.");
      await loadDetail();
      await onChanged();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save corrections.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (acting || saving) return;
    if (!(await saveCorrectionsIfDirty())) return;
    onClose();
  }

  function openScan(participantId?: string) {
    if (!application) return;
    const target = participantId || application.participants.find((participant) => application.kind === "new" ? !participant.reservedBarcode : !participant.cardVerified)?.id || application.participants[0]?.id;
    setScanParticipantId(target || null);
    setBarcodeValue("");
    setManualEntry(false);
    setError("");
  }

  async function submitCard(event?: React.FormEvent) {
    event?.preventDefault();
    if (!scanParticipantId || !barcodeValue.trim()) return;
    if (!(await saveCorrectionsIfDirty())) return;
    setActing(true);
    setError("");
    try {
      const response = await fetch("/api/system/members/card/assign", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationMemberId: scanParticipantId, barcode: barcodeValue.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) throw new Error(data.error || "Card conflict: that card is already assigned or reserved.");
        throw new Error(data.error || "Could not assign card.");
      }
      await loadDetail();
      await onChanged();
      setBarcodeValue("");
      setScanParticipantId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not assign card.");
    } finally {
      setActing(false);
    }
  }

  async function openPrint() {
    if (!(await saveCorrectionsIfDirty())) return;
    window.open(`/staff/applications/${encodeURIComponent(applicationId)}/print`, "_blank", "noopener,noreferrer");
  }

  async function activateMembership(event: React.FormEvent) {
    event.preventDefault();
    if (!allReady || !activationStaffName.trim()) return;
    if (!(await saveCorrectionsIfDirty())) return;
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
          activationStaffName: activationStaffName.trim(),
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
      setError(requestError instanceof Error ? requestError.message : "Could not activate membership.");
    } finally {
      setActing(false);
    }
  }

  if (activeConfirmation) {
    const primary = application?.participants[0];
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><BadgeCheck className="h-11 w-11" /></span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Payment received</p>
          <h2 className="mt-2 text-3xl font-black text-zinc-950">MEMBERSHIP ACTIVE</h2>
          <p className="mt-3 text-lg font-bold text-zinc-700">{primary ? `${primary.firstName} ${primary.lastName}` : application?.reference}</p>
          <p className="mt-1 text-sm text-zinc-500">Card {primary?.reservedBarcode || primary?.scannedBarcode || primary?.currentBarcode || "confirmed"}</p>
          <p className="mt-4 text-sm font-semibold text-zinc-500">{formatMalta(activeConfirmation.activatedAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="max-h-[96vh] w-full overflow-auto rounded-t-3xl bg-[#f6f6f6] shadow-2xl sm:max-w-5xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-[#ff5a0a]">{application?.reference || "Membership application"}</p>
            <h2 className="truncate text-xl font-black text-zinc-950">Review membership</h2>
            {application && <p className="mt-0.5 text-xs font-semibold text-zinc-400">Submitted {formatMalta(application.submittedAt)} · {application.enrollmentGymName}</p>}
          </div>
          <button type="button" onClick={() => void requestClose()} className="rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-500 hover:bg-zinc-50" aria-label="Close review"><X className="h-5 w-5" /></button>
        </div>

        {loading && <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5a0a]" /></div>}
        {!loading && error && <div className="mx-5 mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 sm:mx-6">{error}</div>}

        {!loading && application && form && (
          <div className="space-y-5 p-5 sm:p-6">
            {form.participants.map((participantForm, index) => {
              const participant = application.participants[index];
              const cardReady = application.kind === "new" ? Boolean(participant?.reservedBarcode) : Boolean(participant?.cardVerified);
              return (
                <section key={participantForm.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {participant?.photoUrl ? (
                        <img src={participant.photoUrl} alt="" className="h-24 w-24 rounded-3xl bg-zinc-100 object-cover" />
                      ) : (
                        <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50 text-red-400"><UserRound className="h-9 w-9" /></span>
                      )}
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Participant {index + 1}</p>
                        <h3 className="mt-1 text-2xl font-black text-zinc-950">{participantForm.firstName} {participantForm.lastName}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${participant?.hasPhoto ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{participant?.hasPhoto ? "PHOTO ✓" : "PHOTO REQUIRED"}</span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${cardReady ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{cardReady ? "CARD ASSIGNED ✓" : "CARD REQUIRED"}</span>
                        </div>
                      </div>
                    </div>
                    {cardReady && <p className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-black text-white">{participant.reservedBarcode || participant.scannedBarcode || participant.currentBarcode}</p>}
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500"><ContactRound className="h-4 w-4" /> Personal</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="First name" value={participantForm.firstName} onChange={(value) => updateParticipant(index, "firstName", value)} />
                        <Field label="Surname" value={participantForm.lastName} onChange={(value) => updateParticipant(index, "lastName", value)} />
                        <Field label="ID number" value={participantForm.idNumber} onChange={(value) => updateParticipant(index, "idNumber", value)} />
                        <Field label="Date of birth" type="date" value={participantForm.dateOfBirth} onChange={(value) => updateParticipant(index, "dateOfBirth", value)} />
                      </div>
                    </div>
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500"><UserRound className="h-4 w-4" /> Contact</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Phone" value={participantForm.phone} onChange={(value) => updateParticipant(index, "phone", value)} />
                        <Field label="Email" value={participantForm.email} onChange={(value) => updateParticipant(index, "email", value)} />
                        <Field label="Address" value={participantForm.addressLine1} onChange={(value) => updateParticipant(index, "addressLine1", value)} />
                        <Field label="Address line 2" value={participantForm.addressLine2} onChange={(value) => updateParticipant(index, "addressLine2", value)} />
                        <Field label="Postcode" value={participantForm.postcode} onChange={(value) => updateParticipant(index, "postcode", value)} />
                        <Field label="Next of kin" value={participantForm.nextOfKin} onChange={(value) => updateParticipant(index, "nextOfKin", value)} />
                      </div>
                    </div>
                  </div>

                  {application.participants.length > 1 && (
                    <button type="button" onClick={() => openScan(participant.id)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-black text-zinc-700"><Barcode className="h-4 w-4" /> {cardReady ? "Verify / change card" : "Assign this card"}</button>
                  )}
                </section>
              );
            })}

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-500"><HeartHandshake className="h-4 w-4" /> Membership</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-black uppercase tracking-wide text-zinc-400">Type<select value={form.membershipType} onChange={(event) => updateApplicationField("membershipType", event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900"><option value="single">Single</option><option value="couples">Couples</option><option value="student">Student</option></select></label>
                <label className="text-xs font-black uppercase tracking-wide text-zinc-400">Duration<select value={form.durationKey} onChange={(event) => updateApplicationField("durationKey", event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900">{DURATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <Field label="Start date" type="date" value={form.startDate} onChange={(value) => updateApplicationField("startDate", value)} />
                <Field label="Expiry date" type="date" value={form.expiryDate} onChange={(value) => updateApplicationField("expiryDate", value)} />
              </div>
            </section>

            {scanParticipantId && (
              <section className="rounded-3xl border-2 border-orange-300 bg-orange-50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Scan Card</p><h3 className="mt-1 text-xl font-black text-zinc-950">Scan the physical card now</h3></div>
                  <button type="button" onClick={() => setScanParticipantId(null)} className="rounded-xl p-2 text-zinc-500"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={submitCard} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input ref={barcodeRef} value={barcodeValue} onChange={(event) => setBarcodeValue(event.target.value)} placeholder={manualEntry ? "Enter card barcode manually" : "Scanner input"} className="min-w-0 flex-1 rounded-2xl border border-orange-300 bg-white px-4 py-3 text-lg font-black outline-none focus:ring-4 focus:ring-orange-100" />
                  <button disabled={acting || !barcodeValue.trim()} className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Confirm card</button>
                </form>
                <button type="button" onClick={() => { setManualEntry(true); window.setTimeout(() => barcodeRef.current?.focus(), 0); }} className="mt-3 text-sm font-bold text-orange-700 underline underline-offset-4">Scanner not working? Enter card manually</button>
              </section>
            )}

            {paymentPrompt && (
              <section className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 sm:p-6">
                <h3 className="text-xl font-black text-zinc-950">Confirm payment received</h3>
                <p className="mt-1 text-sm text-zinc-600">Enter the individual staff name processing this payment. Confirmation immediately activates the membership.</p>
                <form onSubmit={activateMembership} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input value={activationStaffName} onChange={(event) => setActivationStaffName(event.target.value)} placeholder="Activation Staff Name" className="min-w-0 flex-1 rounded-2xl border border-emerald-300 bg-white px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-100" />
                  <button disabled={acting || !activationStaffName.trim()} className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Confirm & activate</button>
                </form>
              </section>
            )}

            <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:p-5">
              {dirty && <p className="mb-3 flex items-center gap-2 text-xs font-bold text-orange-700"><Save className="h-4 w-4" /> Corrections will be saved before the next action.</p>}
              <div className="grid gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => openScan()} disabled={acting || saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"><Barcode className="h-5 w-5" /> SCAN CARD</button>
                <button type="button" onClick={() => setPaymentPrompt(true)} disabled={!allReady || acting || saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><CreditCard className="h-5 w-5" /> PAYMENT RECEIVED</button>
                <button type="button" onClick={() => void openPrint()} disabled={acting || saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-zinc-950 bg-white px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-40"><Printer className="h-5 w-5" /> PRINT FORM</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-zinc-400">
      {label}
      <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-zinc-900 outline-none focus:border-[#ff5a0a] focus:ring-3 focus:ring-orange-100" />
    </label>
  );
}
