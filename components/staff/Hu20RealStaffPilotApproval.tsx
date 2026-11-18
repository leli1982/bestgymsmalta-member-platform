"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  ok: true; testOnly: true; employeeId: string; approved: boolean;
  employeeActive: boolean; noBiometricCapture: true;
};
export default function Hu20RealStaffPilotApproval({ employeeId }: { employeeId: string }) {
  const [pilot, setPilot] = useState<Status | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/system/staff-hu20/real-staff-pilot?employeeId=" +
      encodeURIComponent(employeeId), { cache: "no-store" });
    if (response.status === 404) { setAvailable(false); setPilot(null); return; }
    const body = await response.json();
    if (!response.ok || body.ok !== true || body.noBiometricCapture !== true ||
        body.employeeId !== employeeId) throw new Error(body.error || "Pilot approval status unavailable.");
    setAvailable(true);
    setPilot(body);
  }, [employeeId]);
  useEffect(() => { void load().catch(() => setError("Could not load pilot approval status.")); }, [load]);
  async function toggle() {
    if (!pilot) return;
    const approved = !pilot.approved;
    if (!window.confirm((approved ? "APPROVE" : "REVOKE") +
      " this genuine employee for the isolated HU20 TEST pilot? This is an administrative" +
      " eligibility decision ONLY; fingerprint collection remains disabled until the separate" +
      " capture and attendance pilot passes testing and the necessary notices are in place.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/system/staff-hu20/real-staff-pilot", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, approved }),
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true || body.noBiometricCapture !== true ||
          body.approved !== approved) throw new Error(body.error || "Approval change not confirmed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change pilot approval.");
      await load().catch(() => {});
    } finally { setBusy(false); }
  }
  if (!available && !error) return null;
  return <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm"
    aria-label="HU20 real staff pilot approval TEST only">
    <h3 className="font-black text-indigo-950">HU20 real-staff pilot approval — TEST only</h3>
    {error && <p role="alert" className="mt-2 text-red-800">{error}</p>}
    {pilot && <>
      <p className="mt-2 font-semibold">Administrative approval: {pilot.approved ? "APPROVED" : "NOT APPROVED"}</p>
      <p className="mt-1 text-indigo-900">
        Approval is logged against the Super Admin and can be revoked. It does not
        enrol a fingerprint, activate the reader or record attendance.
      </p>
      <button type="button" disabled={busy || (!pilot.employeeActive && !pilot.approved)}
        onClick={() => void toggle()}
        className="mt-3 rounded-lg bg-indigo-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Saving…" : pilot.approved ? "Revoke pilot approval" : "Approve for real-staff TEST pilot"}
      </button>
    </>}
    <p className="mt-3 text-xs text-indigo-800">
      Real fingerprint capture is still disabled. This approval alone is not a lawful basis,
      consent record, or production activation.
    </p>
  </section>;
}
