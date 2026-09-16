"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";

type PrintableParticipant = {
  id: string;
  participantOrder: number;
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
  memberId: string | null;
  barcode: string | null;
  photoUrl: string | null;
};

type PrintableApplication = {
  id: string;
  applicationReference: string;
  kind: string;
  membershipType: string;
  durationKey: string;
  startDate: string;
  expiryDate: string;
  status: string;
  submittedAt: string | null;
  paymentReceivedAt: string | null;
  activatedAt: string | null;
  applicationStaffName: string;
  activationStaffName: string | null;
  enrollmentGymId: string;
  enrollmentGymName: string;
  participants: PrintableParticipant[];
};

function display(value: string | null | undefined) {
  return value && String(value).trim() ? String(value) : "—";
}

function formatDateTime(value: string | null) {
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

export default function StaffApplicationPrint({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<PrintableApplication | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/system/members/applications/${encodeURIComponent(applicationId)}/print`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not prepare form.");
        if (!cancelled) setApplication(data.application);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Could not prepare form.");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (error) {
    return <main className="mx-auto max-w-3xl p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">{error}</div></main>;
  }

  if (!application) {
    return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></main>;
  }

  return (
    <main className="print-root bg-zinc-100 py-6 text-zinc-950 print:bg-white print:py-0">
      <style jsx global>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .print-root { background: white !important; }
          .a4-sheet { box-shadow: none !important; border: 0 !important; width: auto !important; min-height: auto !important; margin: 0 !important; padding: 0 !important; }
          .print-avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end px-4 sm:px-0">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white"><Printer className="h-4 w-4" /> Print</button>
      </div>

      <article className="a4-sheet mx-auto min-h-[297mm] w-full max-w-[210mm] border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="flex items-start justify-between gap-6 border-b-4 border-[#ff5a0a] pb-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ff5a0a]">BestGymsMalta</p>
            <h1 className="mt-1 text-3xl font-black">Membership Application</h1>
            <p className="mt-2 text-sm text-zinc-500">Final corrected application record</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-black">{application.applicationReference}</p>
            <p className="mt-1 text-zinc-500">Submitted {formatDateTime(application.submittedAt)}</p>
            <p className="mt-1 font-bold uppercase text-zinc-700">{application.status}</p>
          </div>
        </header>

        <section className="print-avoid mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info label="Gym" value={application.enrollmentGymName} />
          <Info label="Application" value={application.kind === "renewal" ? "Renewal" : "New membership"} />
          <Info label="Type" value={application.membershipType} />
          <Info label="Duration" value={application.durationKey.replaceAll("_", " ")} />
          <Info label="Start date" value={application.startDate} />
          <Info label="Expiry date" value={application.expiryDate} />
          <Info label="Application staff" value={application.applicationStaffName} />
          <Info label="Activation staff" value={application.activationStaffName} />
        </section>

        <div className="mt-7 space-y-7">
          {application.participants.map((participant) => (
            <section key={participant.id} className="print-avoid border-t border-zinc-300 pt-5">
              <div className="flex items-start gap-5">
                {participant.photoUrl ? (
                  <img src={participant.photoUrl} alt="" className="h-28 w-24 shrink-0 rounded-xl border border-zinc-200 object-cover" />
                ) : (
                  <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs font-bold text-zinc-400">PHOTO</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Participant {participant.participantOrder}</p>
                  <h2 className="mt-1 text-2xl font-black">{participant.firstName} {participant.lastName}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                    <Line label="ID number" value={participant.idNumber} />
                    <Line label="Date of birth" value={participant.dateOfBirth} />
                    <Line label="Phone" value={participant.phone} />
                    <Line label="Email" value={participant.email} />
                    <Line label="Card / Member no." value={participant.barcode} />
                    <Line label="Next of kin" value={participant.nextOfKin} />
                    <div className="col-span-2"><Line label="Address" value={[participant.addressLine1, participant.addressLine2, participant.postcode].filter(Boolean).join(", ")} /></div>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="print-avoid mt-8 grid gap-3 sm:grid-cols-3">
          <Info label="Payment received" value={formatDateTime(application.paymentReceivedAt)} />
          <Info label="Activated" value={formatDateTime(application.activatedAt)} />
          <Info label="Processed gym" value={application.enrollmentGymName} />
        </section>

        <section className="print-avoid mt-12 grid grid-cols-2 gap-10">
          <Signature title="Member Signature" />
          <Signature title="Staff Signature" />
        </section>

        <footer className="mt-10 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-400">
          {application.applicationReference} · BestGymsMalta · Printed final application record
        </footer>
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">{label}</p><p className="mt-1 text-sm font-bold capitalize text-zinc-900">{display(value)}</p></div>;
}

function Line({ label, value }: { label: string; value: string | null | undefined }) {
  return <p><span className="font-bold text-zinc-500">{label}:</span> <span className="font-semibold text-zinc-900">{display(value)}</span></p>;
}

function Signature({ title }: { title: string }) {
  return <div><div className="h-16 border-b border-zinc-500" /><div className="mt-2 flex justify-between gap-4 text-xs font-bold text-zinc-500"><span>{title}</span><span>Date: __________</span></div></div>;
}
