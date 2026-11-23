"use client";

import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import { useCallback, useEffect, useMemo, useState } from "react";

type ReviewMember = {
  id: string; memberNumber: string; fullName: string; status: string;
  membershipExpiry: string | null; enrollmentGymId: string | null;
  photoUrl: string | null; appCreated: boolean; archived: boolean;
  dateOfBirth: string | null; email: string | null;
};

type ReviewGroup = {
  legacyPkCustomer: string; sourceCount: number;
  sourceKind: "repeated_in_source" | "manually_removed";
  assessment: "review_required" | "same_person_candidate";
  state: "pending" | "preclassified" | "reviewed";
  liveIdentityConflict: boolean; missingLiveMatches: number; extraLiveMatches: number;
  reviewNote: string | null;
  reviewedAt: string | null; members: ReviewMember[];
};

type ReviewResponse = {
  source: string;
  sourceTotals: {
    sourceRows: number; sourceRepeatGroups: number; sourceRepeatRows: number;
    manuallyRemoved: number; samePersonCandidates: number;
    manualReviewRequired: number;
  };
  summary: { pending: number; preclassified: number; reviewed: number };
  groups: ReviewGroup[];
};

function stateLabel(group: ReviewGroup) {
  if (group.state === "reviewed") return "Review completed";
  if (group.state === "preclassified") return "Likely same person";
  if (group.liveIdentityConflict) return "Live identity conflict";
  if (group.missingLiveMatches > 0) return "Source members not yet imported";
  return group.sourceKind === "manually_removed"
    ? "Removed from latest Excel — verify live record" : "Needs identity review";
}

export default function SourceDuplicateReview() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "preclassified" | "reviewed">("pending");
  const [page, setPage] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/admin/source-duplicates", {
        cache: "no-store", credentials: "same-origin"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load review.");
      setData(body as ReviewResponse);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load review.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.groups || []).filter((group) =>
      group.state === tab && (
        !term
        || group.legacyPkCustomer.toLowerCase().includes(term)
        || group.members.some((m) =>
          m.memberNumber.toLowerCase().includes(term)
          || m.fullName.toLowerCase().includes(term)
        )
      )
    ).sort((a, b) => a.legacyPkCustomer.localeCompare(b.legacyPkCustomer, undefined, { numeric: true }));
  }, [data, search, tab]);
  const visible = filtered.slice(page * 20, (page + 1) * 20);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));

  async function review(group: ReviewGroup, action: "mark_reviewed" | "reopen") {
    if (busy) return;
    const note = (notes[group.legacyPkCustomer] || "").trim();
    if (action === "mark_reviewed" && note.length < 8) {
      setError("Enter a meaningful review note (at least 8 characters).");
      return;
    }
    if (!window.confirm(action === "mark_reviewed"
      ? `Mark identity review ${group.legacyPkCustomer} as complete? This will NOT merge, delete or archive any members or clear a shared-card scan restriction.`
      : `Reopen identity review ${group.legacyPkCustomer}?`
    )) return;
    setBusy(group.legacyPkCustomer);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/admin/source-duplicates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ legacyPkCustomer: group.legacyPkCustomer, action, note }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save review.");
      setMessage(action === "mark_reviewed"
        ? `Identity review ${group.legacyPkCustomer} completed and audited. No member records changed.`
        : `Identity review ${group.legacyPkCustomer} reopened.`
      );
      await load();
      setNotes((old) => ({ ...old, [group.legacyPkCustomer]: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-8 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <a href="/staff/admin" className="text-sm font-bold text-[#855d00] underline">← Super Admin</a>
        <h1 className="mt-4 text-3xl font-black">Card Conflict Review</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-700">
          Review repeated legacy membership numbers from the final edited member list.
          Two different people can legitimately have the same old pkCustomer: check the name,
          birth date and BGM number before deciding. Every live member remains protected.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Needs review</p>
            <p className="mt-1 text-3xl font-black">{data?.summary.pending ?? "—"}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Likely same person</p>
            <p className="mt-1 text-3xl font-black">{data?.summary.preclassified ?? "—"}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Reviewed</p>
            <p className="mt-1 text-3xl font-black">{data?.summary.reviewed ?? "—"}</p>
          </div>
        </div>
        {data && <p className="mt-3 text-xs text-zinc-500">
          Source: {data.source} · {data.sourceTotals.sourceRows} original rows ·
          {data.sourceTotals.sourceRepeatGroups} repeated-number groups ·
          {data.sourceTotals.manuallyRemoved} manually excluded source rows.
          The “likely same person” category is preclassified only; no live records have been merged.
          Source-row counts reflect your latest edited Excel; some corresponding members may not yet exist in the live database.
        </p>}
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-950">
          Identity review does not release physical cards, modify gym access, change member numbers,
          or remove the separate shared-Scan3 safety checks. Never archive a record based on pkCustomer alone.
        </p>

        {loading && <p className="mt-5 text-sm text-zinc-600">Loading source duplicate review…</p>}
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
        {message && <p className="mt-4 rounded-xl border border-zinc-200 bg-white p-3" role="status">{message}</p>}

        {data && <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {(["pending", "preclassified", "reviewed"] as const).map((value) => (
              <button key={value} type="button"
                onClick={() => { setTab(value); setPage(0); setError(""); }}
                aria-pressed={tab === value}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${tab === value
                  ? "border-[#ffb400] bg-[#ffb400] text-black" : "border-zinc-200 bg-white text-zinc-700"}`}>
                {value === "pending" ? "To review"
                  : value === "preclassified" ? "Likely duplicates" : "Completed"}
              </button>
            ))}
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              aria-label="Search duplicate member number or name"
              placeholder="Search member, name or old number"
              className="min-w-[230px] flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm" />
          </div>
          <p className="mt-3 text-xs text-zinc-500">{filtered.length} review groups in this view</p>
          <div className="mt-4 space-y-4">
            {visible.map((group) => <details key={group.legacyPkCustomer}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="font-black">Legacy number {group.legacyPkCustomer}</span>
                <span className="text-xs font-semibold text-zinc-600">
                  {group.sourceCount} source {group.sourceCount === 1 ? "row" : "rows"} · {group.members.length} live records
                </span>
                <span className="text-xs font-bold text-zinc-700">{stateLabel(group)}</span>
              </summary>
              <div className="mt-4 border-t pt-4">
                {group.sourceKind === "manually_removed" && <p className="mb-3 rounded-lg bg-zinc-100 p-3 text-xs font-semibold">
                  You removed a duplicate row from the edited Excel. Check what remains in the live database;
                  the excluded source row will not be restored.
                </p>}
                {group.liveIdentityConflict && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-900">
                  Live records have different identity details or include an app-created member.
                  This group requires individual checking regardless of source preclassification.
                </p>}
                {group.state === "preclassified" && <p className="mb-3 text-xs text-zinc-600">
                  Names match with corroborating source identity information and no conflicting source
                  ID or birth date. Kept out of the main review queue, but the live records are untouched.
                </p>}
                {group.missingLiveMatches > 0 && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-950">
                  {group.missingLiveMatches} source {group.missingLiveMatches === 1 ? "member" : "members"} not yet matched in the live database.
                  The current Excel contains more people under this old number. Wait until the import is reconciled before completing this group.
                </p>}
                {group.extraLiveMatches > 0 && <p className="mb-3 rounded-lg bg-zinc-100 p-3 text-xs font-semibold">
                  There are {group.extraLiveMatches} more historical live records under this number than in the latest Excel.
                  Check the membership history before deciding which records remain current.
                </p>}
                {group.members.length === 0 && <p className="text-sm text-zinc-700">
                  No corresponding live legacy number found. These source rows will be reconciled at import;
                  do not invent a matching member.
                </p>}
                <div className="grid gap-3 md:grid-cols-2">
                  {group.members.map((member) => <article key={member.id}
                    className="rounded-xl border border-zinc-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 text-center text-2xl leading-[4rem]">
                        {member.fullName.slice(0, 1)}
                        {member.photoUrl && <img src={member.photoUrl} alt={member.fullName}
                          className="absolute inset-0 h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black">{member.fullName}</p>
                        <p className="font-mono text-xs">{member.memberNumber}</p>
                        {member.appCreated && <p className="text-xs font-bold text-amber-800">Protected app-created record</p>}
                        {member.archived && <p className="text-xs font-bold text-zinc-500">Archived</p>}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-700">
                      {member.status} · expiry {formatEuropeanDate(member.membershipExpiry)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      DOB {formatEuropeanDate(member.dateOfBirth)} · {member.email || "Email not recorded"}
                    </p>
                    <a href={`/staff/admin/members/${encodeURIComponent(member.id)}`}
                      className="mt-3 inline-block text-sm font-bold text-[#855d00] underline">
                      Inspect member and history
                    </a>
                  </article>)}
                </div>
                {group.state === "reviewed" ? <div className="mt-4 rounded-lg bg-zinc-100 p-4">
                  <p className="text-sm font-bold">Review completed {formatEuropeanDateTime(group.reviewedAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{group.reviewNote}</p>
                  <button disabled={Boolean(busy)} type="button" onClick={() => void review(group, "reopen")}
                    className="mt-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold">
                    Reopen review
                  </button>
                </div> : <div className="mt-4">
                  <label className="block text-sm font-bold" htmlFor={`note-${group.legacyPkCustomer}`}>
                    Review note (identity evidence and decision)
                  </label>
                  <textarea id={`note-${group.legacyPkCustomer}`}
                    value={notes[group.legacyPkCustomer] || ""}
                    onChange={(e) => setNotes((old) => ({ ...old, [group.legacyPkCustomer]: e.target.value }))}
                    rows={2} maxLength={2000} placeholder="Example: Different DOBs; retain both members separately."
                    className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-sm" />
                  <button type="button"
                    disabled={Boolean(busy) || group.missingLiveMatches > 0 || (notes[group.legacyPkCustomer] || "").trim().length < 8}
                    onClick={() => void review(group, "mark_reviewed")}
                    className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white disabled:opacity-40">
                    {busy === group.legacyPkCustomer ? "Saving…" : "Mark identity review complete"}
                  </button>
                  {group.missingLiveMatches > 0 && <p className="mt-2 text-xs text-amber-900">
                    Review completion is disabled until all source members are matched during import.
                  </p>}
                  {group.state === "preclassified" && <p className="mt-2 text-xs text-zinc-500">
                    Optional: leave this preclassified, or add an audited review decision.
                  </p>}
                </div>}
              </div>
            </details>)}
            {visible.length === 0 && <p className="rounded-xl border bg-white p-5 text-sm text-zinc-600">
              No review groups match this filter.
            </p>}
          </div>
          <nav aria-label="Duplicate review pages" className="mt-6 flex items-center justify-between gap-3">
            <button type="button" disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
            <p className="text-sm text-zinc-600">Page {page + 1} of {pages}</p>
            <button type="button" disabled={page + 1 >= pages}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Next</button>
          </nav>
        </>}
        <p className="mt-8 text-xs text-zinc-500">
          Physical shared-card safety is independent from this identity queue. Existing scanner conflicts
          remain enforced and can be inspected via <a href="/staff/admin/card-conflicts/cards"
            className="font-semibold underline">Legacy Scan3 incident details</a>.
        </p>
      </div>
    </main>
  );
}
