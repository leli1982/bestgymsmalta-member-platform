"use client";

import { useEffect, useState } from "react";
type ArchivedMember = {
  id: string; memberNumber: string; fullName: string; membershipExpiry: string | null;
  cancellationEffectiveDate: string | null; archivedAt: string | null; archivedReason: string | null;
};
export default function SuperAdminArchivedMembers() {
  const [members, setMembers] = useState<ArchivedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  async function reload() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/system/admin/members/archived", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load archive.");
      setMembers(result.members || []); setHasMore(Boolean(result.hasMore));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load archive.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  const filtered = members.filter(member =>
    (member.fullName + " " + member.memberNumber).toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section className="rounded-3xl bg-white p-5 text-zinc-950 sm:p-7">
      <h2 className="text-2xl font-black">Archived members · Super Admin only</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Archived accounts are excluded from ordinary Staff Portal member lookup.
        Open an archived record to restore it. Restore does not renew or undo cancellation.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input aria-label="Search archived members" placeholder="Find by name or BGM number"
          value={query} onChange={event => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 p-3" />
        <button type="button" onClick={() => void reload()} disabled={loading}
          className="rounded-xl border border-zinc-300 px-5 py-3 font-bold disabled:opacity-50">Refresh archive</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {loading && <p className="mt-4 text-sm text-zinc-600">Loading archived records…</p>}
      {!loading && !error && filtered.length === 0 && <p className="mt-4 text-sm text-zinc-600">No matching archived records.</p>}
      {filtered.map(member => (
        <a key={member.id} href={"/staff/admin/members/" + encodeURIComponent(member.id)}
          className="mt-3 block rounded-xl border border-zinc-200 p-4 hover:border-orange-400">
          <span className="font-black">{member.fullName} · {member.memberNumber}</span>
          <span className="mt-1 block text-sm text-zinc-600">Archived {member.archivedAt || "date unavailable"}
            {" · "}Original expiry {member.membershipExpiry || "not recorded"}</span>
          {member.archivedReason && <span className="mt-1 block text-xs text-zinc-600">Reason: {member.archivedReason}</span>}
          <span className="mt-2 block text-sm font-bold text-orange-700">Open member and review Restore →</span>
        </a>
      ))}
      {hasMore && <p className="mt-4 text-sm font-semibold text-amber-800">
        Showing the 100 most recently archived members. Older records require an extended archive search.
      </p>}
    </section>
  );
}
