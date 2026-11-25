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
  isExistingCardOwner?: boolean;
  isScopedCandidate?: boolean;
  canResolveSharedLegacy?: boolean;
};

export type CardConflictResolution = {
  result: "granted" | "expired" | "inactive" | "restricted_gym"; granted: boolean; duplicate?: boolean;
  scanId?: string; scannedBarcode?: string;
  permanentlyAssigned?: boolean;
  credentialKind: "physical_card";
  currentPhysicalCard: string;
  cardMatches: [];
  member: {
    id: string; memberNumber: string; fullName: string; status: string;
    membershipExpiry: string | null; accessScope: string | null;
    accessGymName: string | null; enrollmentGymId: string | null;
    enrollmentGymName: string; hasPhoto: boolean; photoRequired: boolean;
    photoUrl: string | null;
  };
};

function effectiveMembershipStatus(member: CardConflictMember) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (member.membershipExpiry && member.membershipExpiry < today) return "EXPIRED";
  if (String(member.status || "").toLowerCase() !== "active" || !member.membershipExpiry) return "EXPIRED";
  return "ACTIVE";
}

export default function CardConflictCards({ members, scanId, onResolved }: {
  members: CardConflictMember[]; scanId?: string;
  onResolved?: (result: CardConflictResolution) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [assigningMemberId, setAssigningMemberId] = useState<string | null>(null);
  const sharedLegacy = members.length > 0 && members.every(member => member.canResolveSharedLegacy);
  const scoped = sharedLegacy || members.some(member => member.isScopedCandidate);
  const assignedOwner = members.find(member => member.isExistingCardOwner);

  async function assign(member: CardConflictMember) {
    if (!scanId || busy || !onResolved || !scoped) return;
    const isOwner = Boolean(member.isExistingCardOwner);
    if (!sharedLegacy && !isOwner && assignedOwner) {
      setMessage(`This card already belongs to ${assignedOwner.fullName} (${assignedOwner.memberNumber}). Its existing assignment cannot be replaced here. Use a different card or Super Admin correction.`);
      return;
    }
    if (!window.confirm(sharedLegacy
      ? `I have verified ${member.fullName} (${member.memberNumber}) as the owner of this physical card. Only the conflicting card ownership will be corrected; every member account and membership will be retained. Proceed?`
      : isOwner
      ? `I have checked the person against the member details and confirm ${member.fullName} (${member.memberNumber}) for THIS visit. No card ownership will change.`
      : `I have checked the person against their identity/photo and confirm permanently assigning the SCANNED card to ${member.fullName} (${member.memberNumber}). This will affect future scans. Proceed?`)) return;
    setBusy(true);
    setAssigningMemberId(member.id);
    setMessage("");
    try {
      const response = await fetch("/api/system/card-conflicts/assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ scanId, memberId: member.id, confirmed: true,
          resolveSharedLegacy: sharedLegacy, expectedMemberIds: sharedLegacy ? members.map(m => m.id) : undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not verify card assignment.");
      onResolved(payload as CardConflictResolution);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify the card.");
    } finally { setBusy(false); setAssigningMemberId(null); }
  }
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
        This scan matches {members.length} possible members. Verify the person in front of you; no entry has been recorded yet.
        {sharedLegacy ? " Confirming the correct person resolves only this card conflict. No member accounts are removed." : scoped && " Verified card ownership is protected."}
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
            {m.isExistingCardOwner && !sharedLegacy && <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs font-bold text-blue-900">Existing card owner — this assignment will not be changed.</p>}
            {scoped && !m.photoUrl && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-900">NO OFFICIAL PHOTO — verify physical identity before selecting.</p>}
            {scoped && onResolved && (sharedLegacy || m.isScopedCandidate || m.isExistingCardOwner) && (
              <button type="button" onClick={() => void assign(m)}
                disabled={!scanId || busy || (!sharedLegacy && ((!m.isExistingCardOwner && Boolean(assignedOwner)) || effectiveMembershipStatus(m) !== "ACTIVE"))}
                className="mt-4 w-full rounded-xl bg-zinc-950 px-4 py-3 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-400">
                {assigningMemberId === m.id ? "Verifying…" :
                  sharedLegacy ? "Select this member & assign card" :
                  effectiveMembershipStatus(m) !== "ACTIVE" ? "Access unavailable — expired" :
                  m.isExistingCardOwner ? "Verify person & check in (no transfer)" :
                  assignedOwner ? "Card belongs to another member" :
                  "Assign this card & check in"}
              </button>
            )}
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
