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
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-black text-white"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
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
