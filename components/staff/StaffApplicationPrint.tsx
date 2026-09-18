"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import MembershipA4Sheet, {
  type PrintableApplication,
} from "@/components/staff/MembershipA4Sheet";

export default function StaffApplicationPrint({
  applicationId,
}: {
  applicationId: string;
}) {
  const [application, setApplication] = useState<PrintableApplication | null>(null);
  const [error, setError] = useState("");
  const [printDialogOpened, setPrintDialogOpened] = useState(false);
  const [confirmingPrint, setConfirmingPrint] = useState(false);
  const [printConfirmed, setPrintConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/system/members/applications/${encodeURIComponent(applicationId)}/print`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not prepare form.");
        if (!cancelled) setApplication(data.application);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not prepare form."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function confirmPrinted() {
    setConfirmingPrint(true);
    setError("");
    try {
      const response = await fetch(
        `/api/system/members/applications/${encodeURIComponent(applicationId)}/print`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_print" }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not confirm printing.");
      }
      setPrintConfirmed(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not confirm printing."
      );
    } finally {
      setConfirmingPrint(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </main>
    );
  }

  return (
    <main className="print-root bg-zinc-100 py-6 text-zinc-950 print:bg-white print:py-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-root { background: white !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[194mm] items-center justify-between gap-4 px-4 sm:px-0">
        <p className="text-sm font-bold text-zinc-600">
          {application.participants.length} member sheet
          {application.participants.length === 1 ? "" : "s"} · one A4 page per member
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setPrintDialogOpened(true);
              window.print();
            }}
            disabled={printConfirmed}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            <Printer className="h-4 w-4" /> {printConfirmed ? "Printed" : "Print Membership"}
          </button>
          {printDialogOpened && !printConfirmed ? (
            <button
              type="button"
              onClick={() => void confirmPrinted()}
              disabled={confirmingPrint}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              {confirmingPrint ? "Confirming…" : "CONFIRM PRINTED"}
            </button>
          ) : null}
          {printConfirmed ? (
            <button
              type="button"
              onClick={() => window.close()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-black text-emerald-800"
            >
              Return to Staff Flow
            </button>
          ) : null}
        </div>
      </div>

      {application.participants.map((participant) => (
        <MembershipA4Sheet
          key={participant.id}
          application={application}
          participant={participant}
        />
      ))}
    </main>
  );
}
