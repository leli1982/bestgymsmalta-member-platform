"use client";

import { useEffect, useState } from "react";
export default function StaffPunchClockInformation() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted=true;
    void fetch("/api/staff-hu20/portal-capability", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(body => { if (mounted) setEnabled(body?.punchClockEnabled === true); })
      .catch(() => { if (mounted) setEnabled(false); });
    return ()=>{mounted=false;};
  }, []);
  return <main className="min-h-screen bg-zinc-50 p-6 text-zinc-950">
    <div className="mx-auto max-w-xl rounded-2xl border bg-white p-6">
      <a href="/staff" className="font-semibold underline">Back to Staff Portal</a>
      <h1 className="mt-5 text-2xl font-bold">Punch Clock — TEST</h1>
      {enabled === null ? <p className="mt-3">Checking your gym's setting…</p> :
       !enabled ? <p className="mt-3">Punch Clock is not enabled for your gym. Ask Super Admin if this should be activated.</p> :
       <><p className="mt-3">Your gym's TEST Punch Clock is enabled.</p>
         <p className="mt-3 text-sm">Clock IN and OUT using the dedicated Windows HU20 fingerprint terminal, not this browser page. A supervised Super Admin TEST kiosk window is required. Only fictional TEST staff are supported; real payroll is disabled.</p></>}
    </div>
  </main>;
}
