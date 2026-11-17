"use client";

import { useEffect, useState } from "react";

type Gym = { id: string; name: string; status: string; hu20_punch_clock_enabled: boolean };
type Terminal = { id: string; gym_id: string; name: string; active: boolean };
type Inventory = { ok: true; gyms: Gym[]; terminals: Terminal[] };

export default function Hu20RealStaffReadiness({
  active, homeGymId, hasHourlyRate, hasEmploymentType,
}: {
  active: boolean;
  homeGymId: string;
  hasHourlyRate: boolean;
  hasEmploymentType: boolean;
}) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [status, setStatus] = useState<"loading" | "hidden" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    void fetch("/api/system/staff-hu20/terminals", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          if (mounted) setStatus("hidden");
          return;
        }
        if (!response.ok) throw new Error("Could not load the HU20 TEST terminal inventory.");
        const result = await response.json() as Inventory;
        if (result.ok !== true || !Array.isArray(result.gyms) || !Array.isArray(result.terminals)) {
          throw new Error("Unexpected HU20 TEST inventory response.");
        }
        if (mounted) {
          setInventory(result);
          setStatus("ready");
        }
      })
      .catch(() => { if (mounted) setStatus("error"); });
    return () => { mounted = false; };
  }, []);

  // TEST API is 404 in Production. This checklist does not trigger biometric
  // activity; a separate individual Super Admin pilot authorisation is required.
  if (status === "hidden") return null;

  const homeGym = inventory?.gyms.find((gym) => gym.id === homeGymId);
  const homeTerminalCount = inventory?.terminals.filter((terminal) =>
    terminal.active && terminal.gym_id === homeGymId).length ?? 0;
  const checks = [
    { label: "Employee record active", passed: active },
    { label: "Home gym active", passed: homeGym?.status === "active" },
    { label: "Employment type recorded", passed: hasEmploymentType },
    { label: "Hourly rate recorded", passed: hasHourlyRate },
    { label: "Home gym has a registered TEST terminal", passed: homeTerminalCount > 0 },
  ];

  return <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm"
    aria-label="Real staff HU20 pilot readiness — no biometric capture">
    <h3 className="font-black text-slate-900">HU20 real-staff onboarding — preparation only</h3>
    <p className="mt-1 text-slate-700">
      This is a read-only administrative checklist. The separate real-staff fingerprint
      pilot requires individual Super Admin authorisation and the isolated TEST environment.
      Production biometric attendance remains disabled.
    </p>
    {status === "loading" && <p className="mt-2 text-slate-700">Checking TEST terminal inventory…</p>}
    {status === "error" && <p className="mt-2 text-red-700" role="alert">
      TEST inventory unavailable. No biometric action is permitted.
    </p>}
    {status === "ready" && <>
      <p className="mt-3 text-xs text-slate-600">
        Home gym: {homeGym?.name || "Not found"} · Gym TEST switch: {
          homeGym?.hu20_punch_clock_enabled ? "ON" : "OFF"
        } (does not authorise real-staff biometrics)
      </p>
      <ul className="mt-3 space-y-1">
        {checks.map((check) => <li key={check.label}>
          <span className={check.passed ? "font-semibold text-emerald-800" : "font-semibold text-amber-800"}>
            {check.passed ? "Recorded" : "Needs review"}
          </span>{" — "}{check.label}
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-600">
        Staff working across gyms should enrol only once when an approved system becomes available.
        Their home gym is an administrative field, not a restriction on cross-gym attendance.
      </p>
    </>}
    <p className="mt-3 text-xs text-slate-700">
      Separate requirements before any real fingerprint use: necessity assessment, GDPR lawful
      basis and Article 9 condition, DPIA where required, retention/deletion arrangements,
      staff notice, and a workable non-biometric attendance alternative.
      Super Admin manual attendance remains available under Staff Management → Timesheets.
    </p>
    <p className="mt-2 text-xs font-bold text-slate-900">
      REAL BIOMETRIC ENROLMENT DISABLED — no fingerprint capture button is available.
    </p>
  </section>;
}
