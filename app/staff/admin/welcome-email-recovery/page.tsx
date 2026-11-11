"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { applicationId: string; newlySent: number; previouslySent: number; pending: number };
type Result = {
  date: string; activatedNewApplications: number; newlySent: number;
  previouslySent: number; pending: number; results: Item[];
};

export default function WelcomeEmailRecoveryPage() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function replay() {
    if (busy) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch("/api/system/maintenance/replay-welcome-20261111", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not check and resend welcome emails.");
      } else {
        setReport(json as Result);
      }
    } catch {
      setError("Network error. Check the connection before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 text-zinc-100">
      <Link href="/staff/admin" className="text-sm text-emerald-400 hover:underline">
        Back to Super Admin
      </Link>
      <h1 className="mt-6 text-2xl font-bold">Welcome email recovery</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        Checks all newly activated memberships for <strong>11 November 2026</strong>,
        sends welcome packages only to recipients without a successful send record,
        and skips those already sent. Memberships, payments and card assignments are not changed.
      </p>
      <button type="button" disabled={busy} onClick={replay}
        className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 font-bold text-white hover:bg-emerald-500 disabled:opacity-60">
        {busy ? "Checking and sending..." : "Send missed welcome emails"}
      </button>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-500 px-4 py-3 text-red-200">{error}</p>}
      {report && (
        <section className="mt-6 space-y-3 rounded-xl border border-zinc-600 p-5">
          <h2 className="font-semibold">Recovery result — {report.date}</h2>
          <p>New activated applications: <strong>{report.activatedNewApplications}</strong></p>
          <p>Emails accepted for sending: <strong>{report.newlySent}</strong></p>
          <p>Already sent (not repeated): <strong>{report.previouslySent}</strong></p>
          <p>Still pending or failed: <strong>{report.pending}</strong></p>
          <p className="text-xs text-zinc-400">A successful send means the mail server accepted the message, not that it reached an inbox.</p>
        </section>
      )}
    </main>
  );
}
