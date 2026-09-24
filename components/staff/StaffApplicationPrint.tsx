"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [printFit, setPrintFit] = useState<"checking" | "fits" | "overflow">("checking");
  const printRootRef = useRef<HTMLElement>(null);

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

  useLayoutEffect(() => {
    if (!application) return;
    let cancelled = false;
    const root = printRootRef.current;
    if (!root) return;

    const sheets = Array.from(root.querySelectorAll<HTMLElement>(".bgm-member-a4-sheet"));
    const measure = () => {
      if (cancelled) return;
      const overflows = sheets.some((sheet) => {
        const footer = sheet.querySelector<HTMLElement>(".bgm-print-footer");
        const signatures = sheet.querySelectorAll<HTMLElement>(".bgm-signatures");
        const lastSignature = signatures[signatures.length - 1];
        return (
          sheet.scrollHeight > sheet.clientHeight + 1 ||
          !footer ||
          !lastSignature ||
          lastSignature.getBoundingClientRect().bottom + 4 > footer.getBoundingClientRect().top
        );
      });
      setPrintFit((previous) => {
        const next = sheets.length && !overflows ? "fits" : "overflow";
        return previous === next ? previous : next;
      });
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    for (const sheet of sheets) {
      observer?.observe(sheet);
      for (const child of sheet.querySelectorAll<HTMLElement>(".bgm-print-section, .bgm-signatures")) {
        observer?.observe(child);
      }
    }
    const images = Array.from(root.querySelectorAll<HTMLImageElement>(".bgm-member-a4-sheet img"));
    for (const image of images) image.addEventListener("load", measure);
    window.addEventListener("resize", measure);
    document.fonts.ready.then(measure).catch(() => {});
    const frame = window.requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      for (const image of images) image.removeEventListener("load", measure);
      observer?.disconnect();
    };
  }, [application]);

  useEffect(() => {
    document.body.classList.toggle("bgm-print-blocked", printFit !== "fits");
    return () => document.body.classList.remove("bgm-print-blocked");
  }, [printFit]);

  async function confirmPrinted() {
    if (printFit !== "fits" || !printDialogOpened) return;
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
      // The print window uses noopener, so notify the original Staff tab
      // through a same-origin channel rather than relying on tab focus.
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("bgm-membership-print");
        channel.postMessage({ type: "print-confirmed", applicationId });
        channel.close();
      }
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
    <main ref={printRootRef} className="print-root bg-zinc-100 py-6 text-zinc-950 print:bg-white print:py-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-root { background: white !important; padding: 0 !important; }
          .bgm-print-blocker { display: none !important; }
          .bgm-print-blocked .bgm-member-a4-sheet { display: none !important; }
          .bgm-print-blocked .bgm-print-blocker { display: block !important; padding: 12mm; font: 14pt Arial, sans-serif; color: #991b1b; }
        }
      `}</style>

      {printFit !== "fits" && (
        <div role="alert" className="no-print mx-auto mb-4 max-w-[194mm] rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">
          {printFit === "checking"
            ? "Checking that every membership agreement fits on one A4 page…"
            : "One or more agreements cannot fit on a single A4 page without hiding required information. Printing and print confirmation are blocked. Please review the full declaration wording in Membership Settings before printing."}
        </div>
      )}
      <div className="bgm-print-blocker hidden" aria-hidden="true">Printing blocked: the membership agreement has not been confirmed to fit on one A4 page. No agreement has been printed.</div>
      <div className="no-print mx-auto mb-4 flex max-w-[194mm] items-center justify-between gap-4 px-4 sm:px-0">
        <p className="text-sm font-bold text-zinc-600">
          {application.participants.length} member sheet
          {application.participants.length === 1 ? "" : "s"} · one A4 page per member
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (printFit !== "fits") return;
              setPrintDialogOpened(true);
              window.print();
            }}
            disabled={printConfirmed || printFit !== "fits"}
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
