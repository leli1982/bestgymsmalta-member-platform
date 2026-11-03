"use client";

import { useEffect, useRef } from "react";

const SUBMITTED_MARKER = "End of Day submitted";

export default function EndOfDayPrintBridge() {
  const previousSubmitted = useRef(false);
  const printed = useRef(false);

  useEffect(() => {
    const isSubmitted = () => document.body.textContent?.includes(SUBMITTED_MARKER) ?? false;

    // Establish the initial state so reopening an already-submitted report does not auto-print.
    previousSubmitted.current = isSubmitted();

    const observer = new MutationObserver(() => {
      const submitted = isSubmitted();

      if (submitted && !previousSubmitted.current && !printed.current) {
        printed.current = true;
        window.setTimeout(() => window.print(), 0);
      }

      previousSubmitted.current = submitted;
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      @media print {
        @page {
          margin: 12mm;
        }

        html,
        body,
        main {
          background: #fff !important;
        }

        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        main {
          min-height: auto !important;
          padding: 0 !important;
        }

        a,
        button {
          display: none !important;
        }

        .shadow-sm,
        .shadow-md,
        .shadow-lg {
          box-shadow: none !important;
        }
      }
    `}</style>
  );
}
