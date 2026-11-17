"use client";

import { formatEuropeanDateTime } from "@/lib/europeanDate";
import { hu20TerminalContactStatus } from "@/lib/hu20TerminalFleet";

type Gym = { id: string; name: string; status: string; hu20_punch_clock_enabled: boolean };
type Terminal = { id: string; gym_id: string; name: string; active: boolean; last_seen_at: string | null };

export default function Hu20RolloutReadinessPanel({ gyms, terminals, checkedAt }: {
  gyms: Gym[]; terminals: Terminal[]; checkedAt: number | null;
}) {
  const activeTerminals = terminals.filter((terminal) => terminal.active);
  return <section className="mt-6 rounded border border-slate-200 bg-white p-4"
    aria-label="HU20 TEST rollout overview">
    <h2 className="text-xl font-semibold">Gym rollout overview — TEST only</h2>
    <p className="mt-1 text-sm text-slate-600">
      Read-only inventory, not a reader health check or approval for live staff payroll.
      Recent authentication does not prove a PC or its fingerprint reader is online.
      Only fictional TEST employees are supported.
    </p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {gyms.map((gym) => {
        const devices = activeTerminals.filter((terminal) => terminal.gym_id === gym.id);
        const recent = checkedAt === null ? 0 : devices.filter((terminal) =>
          hu20TerminalContactStatus(terminal.last_seen_at, checkedAt) === "recent").length;
        const nextStep = gym.status !== "active"
          ? "Inactive gym: leave its punch clock disabled."
          : devices.length === 0
            ? "Register this gym's dedicated Windows PC when it is ready for TEST."
            : !gym.hu20_punch_clock_enabled
              ? "TEST disabled: enable only for a supervised fictional staff test."
              : "TEST enabled: verify reader, fictional enrollment, Clock IN/OUT and audit records.";
        return <article key={gym.id} className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-semibold">{gym.name}</h3>
          <p className="mt-1 text-sm">Gym: <strong>{gym.status}</strong> · TEST punch clock: <strong>
            {gym.hu20_punch_clock_enabled ? "ON" : "OFF"}</strong></p>
          <p className="mt-1 text-sm">
            Active registered PCs: <strong>{devices.length}</strong> · Authenticated requests in last 15 min:
            <strong> {recent}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-700">{nextStep}</p>
          {devices.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
            {devices.map((terminal) => <li key={terminal.id}>
              {terminal.name} — last authenticated: {terminal.last_seen_at
                ? formatEuropeanDateTime(terminal.last_seen_at) : "never"}
            </li>)}
          </ul>}
        </article>;
      })}
    </div>
    <p className="mt-4 text-sm">
      <a href="/staff/admin/gyms" className="font-semibold underline">Manage per-gym TEST switches</a>
      {" · "}
      <a href="/staff/admin/staff/terminals/enrollment" className="font-semibold underline">
        Supervised TEST enrollment</a>
    </p>
    <p className="mt-2 text-xs text-slate-600">
      A new PC still needs its own installer verification, terminal registration, encrypted credentials
      and supervised attendance test before rollout. Production remains disabled.
    </p>
  </section>;
}
