"use client";

import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";

import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string; memberNumber: string; fullName: string; legacyPkCustomer: string | null;
  status: string; membershipExpiry: string | null; enrollmentGymName: string;
  photoUrl: string | null; updatedAt: string;
};
type Group = {
  scan3: string; reviewId: string | null; flaggedAt: string | null;
  flaggedGym: string | null; flaggedBy: string | null; members: Member[];
};

export default function CardConflictReview() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState<Array<{ id: string; scan3: string; flaggedAt: string }>>([]);
  const [open, setOpen] = useState("");
  const [newCard, setNewCard] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/admin/card-conflicts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load conflicts.");
      setGroups(data.conflicts || []);
      setReady(data.flaggedWithoutActiveConflict || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load conflicts."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function act(group: Group, action: "remove_card" | "change_card" | "resolve", member?: Member) {
    if (busy) return;
    const text = action === "remove_card"
      ? `Remove card ${group.scan3} from ${member?.fullName}?`
      : action === "change_card"
        ? `Assign card ${newCard[member?.id || ""]} to ${member?.fullName}?`
        : `Resolve review for card ${group.scan3}?`;
    if (!window.confirm(text)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/system/admin/card-conflicts", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scan3: group.scan3, reviewId: group.reviewId, action,
          memberId: member?.id, expectedUpdatedAt: member?.updatedAt,
          newScan3: newCard[member?.id || ""] || "", note,
          reason: "Super Admin Card Conflict Review",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The action failed.");
      setMessage(action === "resolve" ? "Review resolved." : "Card assignment saved and audited.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The action failed."); }
    finally { setBusy(false); }
  }
  return <main className="bgm-admin-light min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950">
    <div className="mx-auto max-w-6xl">
      <a href="/staff/admin" className="font-bold text-orange-700">← Super Admin</a>
      <h1 className="mt-4 text-3xl font-black">Card Conflict Review</h1>
      <p className="mt-2 text-sm text-zinc-600">All active members sharing a physical Scan3 appear together. Staff flags include the gym, user and time. Open each member to inspect the full record, edit it or archive it.</p>
      <p className="mt-3 font-bold">{groups.length} active card conflicts · {groups.filter(g => g.reviewId).length} flagged for review</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
      <div className="mt-6 space-y-3">
        {ready.map(item => <section key={item.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
          <h2 className="font-black">Scan3 {item.scan3} · ready to resolve</h2>
          <p className="text-sm">Flagged {formatEuropeanDateTime(item.flaggedAt)}. Fewer than two active members now share this card.</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Resolution note" className="mt-3 w-full rounded-lg border p-2" />
          <button disabled={busy || !note.trim()}
            onClick={() => void act({ scan3: item.scan3, reviewId: item.id, flaggedAt: item.flaggedAt, flaggedGym: null, flaggedBy: null, members: [] }, "resolve")}
            className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">Mark conflict resolved</button>
        </section>)}
        {groups.map(group => <section key={group.scan3} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setOpen(open === group.scan3 ? "" : group.scan3)}
            className="flex w-full justify-between gap-3 text-left font-black">
            <span>Scan3 {group.scan3} · {group.members.length} active members</span>
            <span className={group.reviewId ? "text-red-700" : "text-zinc-500"}>{group.reviewId ? "FLAGGED" : "Open"}</span>
          </button>
          {group.flaggedAt && <p className="mt-2 text-sm text-zinc-600">Flagged {formatEuropeanDateTime(group.flaggedAt)} · {group.flaggedGym || "Gym unknown"} · {group.flaggedBy || "Staff unknown"}</p>}
          {open === group.scan3 && <div className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {group.members.map(m => <article key={m.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 text-center text-3xl leading-[5rem]">
                    {m.fullName.slice(0, 1)}
                    {m.photoUrl && <img src={m.photoUrl} alt={m.fullName} className="absolute inset-0 h-full w-full object-cover" />}
                  </div>
                  <div><h2 className="font-black">{m.fullName}</h2>
                    <p className="font-mono">{m.memberNumber}</p>
                    <p className="text-sm">Legacy pkCustomer: {m.legacyPkCustomer || "Not recorded"}</p></div>
                </div>
                <p className="mt-3 text-sm">{m.status} · expires {formatEuropeanDate(m.membershipExpiry)} · {m.enrollmentGymName}</p>
                <a className="mt-3 inline-block font-bold text-orange-700 underline"
                  href={`/staff/admin/members/${encodeURIComponent(m.id)}`}>Inspect full record · edit or archive member</a>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => void act(group, "remove_card", m)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-800">Remove card assignment</button>
                  <input aria-label={`New card for ${m.fullName}`} value={newCard[m.id] || ""}
                    onChange={e => setNewCard(v => ({ ...v, [m.id]: e.target.value }))}
                    className="w-36 rounded-lg border p-2 font-mono text-sm" placeholder="New Scan3" />
                  <button disabled={busy || !newCard[m.id]?.trim()} onClick={() => void act(group, "change_card", m)}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Change card</button>
                </div>
              </article>)}
            </div>
            {group.reviewId && <div className="mt-5 rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-bold">After card assignments or member records are corrected, mark the review resolved. Both members may remain in the database.</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Resolution note" className="mt-2 w-full rounded-lg border p-2" />
              <button disabled={busy || !note.trim()} onClick={() => void act(group, "resolve")}
                className="mt-2 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">Mark conflict resolved</button>
            </div>}
          </div>}
        </section>)}
      </div>
    </div>
  </main>;
}
