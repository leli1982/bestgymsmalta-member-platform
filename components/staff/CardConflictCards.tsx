"use client";

import { formatEuropeanDate } from "@/lib/europeanDate";

import { useState } from "react";

export type CardConflictMember = {
  id: string;
  memberNumber: string;
  fullName: string;
  legacyPkCustomer: string | null;
  status: string;
  membershipExpiry: string | null;
  enrollmentGymName: string;
  scan3: string;
  photoUrl: string | null;
};

function effectiveMembershipStatus(member: CardConflictMember) {
  const today = new Date().toISOString().slice(0, 10);
  if (String(member.status || "").toLowerCase() !== "active") return "INACTIVE";
  if (member.membershipExpiry && member.membershipExpiry < today) return "EXPIRED";
  return "ACTIVE";
}

export default function CardConflictCards({ members, scanId }: {
  members: CardConflictMember[]; scanId?: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function flag() {
    if (!scanId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/system/card-conflicts/flag", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ scanId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not flag the card.");
      setMessage("Sent to Super Admin for Card Conflict Review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not flag the card.");
    } finally { setBusy(false); }
  }
  return (
    <section className="mt-6 rounded-2xl border-4 border-amber-300 bg-amber-50 p-5 text-left text-zinc-950">
      <h2 className="text-center text-2xl font-black text-amber-900">Shared physical card / Scan3</h2>
      <p className="mt-2 text-center text-sm font-bold text-amber-900">
        This scan matches {members.length} members. Identify the person manually; no check-in was recorded.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <article key={m.id} className="rounded-2xl border border-amber-200 bg-white p-4">
            <div className="flex gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 text-center text-3xl font-bold leading-[5rem] text-zinc-400">
                {m.fullName.slice(0, 1)}
                {m.photoUrl && <img src={m.photoUrl} alt={`${m.fullName} photo`} className="absolute inset-0 h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black">{m.fullName}</h3>
                <p className="font-mono text-sm font-bold">{m.memberNumber}</p>
                <p className="text-xs">Legacy pkCustomer: {m.legacyPkCustomer || "Not recorded"}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="font-bold">Membership</dt>
                <dd className="mt-1">
                  <span
                    className={
                      effectiveMembershipStatus(m) === "EXPIRED"
                        ? "inline-flex rounded-full bg-red-600 px-3 py-1 text-sm font-black uppercase tracking-wide text-white"
                        : effectiveMembershipStatus(m) === "ACTIVE"
                          ? "inline-flex rounded-full bg-emerald-600 px-3 py-1 text-sm font-black uppercase tracking-wide text-white"
                          : "inline-flex rounded-full bg-amber-500 px-3 py-1 text-sm font-black uppercase tracking-wide text-white"
                    }
                  >
                    {effectiveMembershipStatus(m)}
                  </span>
                  <span className="mt-2 block font-bold text-zinc-700">
                    Expires {formatEuropeanDate(m.membershipExpiry, "unknown")}
                  </span>
                </dd>
              </div>
              <div><dt className="font-bold">Enrollment gym</dt><dd>{m.enrollmentGymName}</dd></div>
              <div className="col-span-2"><dt className="font-bold">Shared Scan3 / card number</dt><dd className="font-mono">{m.scan3}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <button type="button" disabled={!scanId || busy} onClick={() => void flag()}
        className="mt-5 w-full rounded-xl bg-amber-900 px-5 py-3 font-black text-white disabled:opacity-50">
        {busy ? "Flagging…" : "Flag to Admin"}
      </button>
      {message && <p role="status" className="mt-2 text-center text-sm font-bold">{message}</p>}
    </section>
  );
}
