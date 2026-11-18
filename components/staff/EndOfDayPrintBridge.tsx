"use client";

import { useEffect, useRef } from "react";

const SUBMITTED_EVENT = "bgm:end-of-day-submitted";

export default function EndOfDayPrintBridge() {
  const printed = useRef(false);

  useEffect(() => {
    // Only a successful POST dispatches this event. Loading a previously
    // submitted report or refreshing the page must NEVER open a print dialog.
    const onSuccess = () => {
      if (printed.current) return;
      printed.current = true;
      // Give React time to render the submitted report before printing it.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.print());
      });
    };
    window.addEventListener(SUBMITTED_EVENT, onSuccess);
    return () => window.removeEventListener(SUBMITTED_EVENT, onSuccess);
  }, []);

  return (
    <style jsx global>{`
      .bgm-eod-print-only { display: none; }
      @media print {
        @page {
          size: A4 portrait;
          margin: 9mm;
        }
        .bgm-eod-screen-report { display: none !important; }
        .bgm-eod-print-only {
          display: block !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 8.5pt;
          line-height: 1.25;
          color: #000;
          background: #fff;
        }
        .bgm-eod-print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #111;
          padding-bottom: 3mm;
          margin-bottom: 3mm;
        }
        .bgm-eod-print-header h1 { margin-top: 1mm; font-size: 14pt; font-weight: bold; }
        .bgm-eod-print-meta { text-align: right; font-size: 8pt; }
        .bgm-eod-print-only table { width: 100%; border-collapse: collapse; }
        .bgm-eod-print-only th, .bgm-eod-print-only td { padding: 1mm 1.2mm; border-bottom: 1px solid #ddd; vertical-align: top; }
        .bgm-eod-print-only td:last-child { text-align: right; white-space: nowrap; }
        .bgm-eod-print-money { margin-bottom: 3mm; }
        .bgm-eod-print-money thead th { text-align: right; border-bottom: 1px solid #444; }
        .bgm-eod-print-money thead th:first-child, .bgm-eod-print-money tbody th { text-align: left; }
        .bgm-eod-print-money tbody td { text-align: right; }
        .bgm-eod-print-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
        .bgm-eod-print-columns h2 { font-size: 9pt; margin: 3mm 0 1mm; font-weight: 800; border-bottom: 1px solid #888; }
        .bgm-eod-print-columns tr { break-inside: avoid; }
        .bgm-eod-print-totals { margin-top: 4mm; margin-left: auto; max-width: 95mm; }
        .bgm-eod-print-totals th { text-align: left; }
        .bgm-eod-print-grand th, .bgm-eod-print-grand td { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 900; font-size: 11pt; }
        .bgm-eod-print-footer { margin-top: 4mm; padding-top: 2mm; border-top: 1px solid #bbb; font-size: 7pt; color: #555; }
        .bgm-eod-print-only section { break-inside: avoid; }

        html,
        body,
        main {
          background: #fff !important;
        }

        body {
          print-color-adjust: economy;
          -webkit-print-color-adjust: economy;
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
