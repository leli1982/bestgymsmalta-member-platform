"use client";

import { useEffect, useState } from "react";

type SystemUser = {
  gymId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
};
type Gym = { id: string; name: string; status?: string };
type Candidate = {
  id: string;
  memberNumber: string;
  fullName: string;
  status: string;
  membershipExpiry: string;
  mobile: string;
  email: string;
  officialPhotoPath?: string | null;
};

export default function IssueNewCardPanel() {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [member, setMember] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("lost");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [authResponse, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const authData = await authResponse.json();
        const gymsData = await gymsResponse.json();
        const nextUser = authData.authenticated ? authData.user : null;
        setUser(nextUser);
        setGyms((gymsData.gyms || []).filter((gym: Gym) => gym.status !== "coming_soon"));
        if (nextUser?.gymId) setGymId(nextUser.gymId);
      } catch {
        setError("Could not load card-replacement tools.");
      }
    }
    void load();
  }, []);

  const canReplace = Boolean(
    user?.isSuperAdmin || user?.permissions.includes("cards.replace")
  );

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Enter at least 2 characters, a member number, mobile or email.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/system/members/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not search members.");
        return;
      }
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch {
      setError("Could not search members.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceCard() {
    if (!member) return;
    if (!barcode.trim()) {
      setError("Scan the new preprinted card first.");
      return;
    }
    if (!user?.gymId && !gymId) {
      setError("Select the gym handling this replacement.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/system/members/card/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          barcode,
          reason,
          gymId: user?.gymId ? undefined : gymId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not issue the replacement card.");
        return;
      }
      setMessage(`Replacement card ${data.replacement.newBarcode} issued to ${member.fullName}. Membership dates were not changed.`);
      setMember({ ...member, memberNumber: data.replacement.newBarcode });
      setBarcode("");
    } catch {
      setError("Could not issue the replacement card.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <div className="rounded-2xl bg-white p-6 text-zinc-700">Staff login required.</div>;
  }
  if (!canReplace) {
    return <div className="rounded-2xl bg-white p-6 text-zinc-700">This account cannot replace membership cards.</div>;
  }

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{message}</div>}

      {user.isSuperAdmin && !user.gymId && (
        <label className="block rounded-2xl border border-zinc-200 bg-white p-5 text-sm font-bold">
          Replacement handled at
          <select value={gymId} onChange={(event) => setGymId(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-3">
            <option value="">Select gym</option>
            {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
          </select>
        </label>
      )}

      <form onSubmit={search} className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-black">Find member</h2>
        <div className="mt-3 flex gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, member number, mobile or email" className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-4 py-3" />
          <button disabled={busy} className="rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-40">Search</button>
        </div>
        {candidates.length > 0 && (
          <div className="mt-4 space-y-2">
            {candidates.map((candidate) => (
              <button key={candidate.id} type="button" onClick={() => { setMember(candidate); setCandidates([]); setQuery(""); setError(""); }} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 p-3 text-left">
                <span><span className="font-bold">{candidate.fullName}</span><span className="block text-sm text-zinc-500">{candidate.memberNumber} · {candidate.mobile || candidate.email || "No contact"}</span></span>
                <span className="text-sm font-bold text-orange-600">Select</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {member && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="grid gap-5 sm:grid-cols-[150px_1fr] sm:items-start">
            {member.officialPhotoPath ? (
              <img src={`/api/system/members/photo/${encodeURIComponent(member.id)}`} alt={`${member.fullName} official photo`} className="aspect-square w-36 rounded-2xl object-cover" />
            ) : (
              <div className="flex aspect-square w-36 items-center justify-center rounded-2xl bg-zinc-100 text-5xl font-black text-zinc-300">{member.fullName.slice(0, 1).toUpperCase()}</div>
            )}
            <div>
              <h2 className="text-2xl font-black">{member.fullName}</h2>
              <p className="mt-1 font-mono text-lg font-bold text-zinc-600">Current card: {member.memberNumber || "Not recorded"}</p>
              <p className="mt-2 text-sm text-zinc-500">Status: {member.status.toUpperCase()} · Expiry: {member.membershipExpiry || "Not recorded"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Replacement reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-3">
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="damaged">Damaged</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-bold">New preprinted card
              <input value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void replaceCard(); } }} autoFocus placeholder="Scan new card barcode" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-3 font-mono" />
            </label>
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Issue New Card changes the card only. It does not renew or extend the membership.</p>
          <button type="button" disabled={busy || !barcode.trim()} onClick={() => void replaceCard()} className="mt-4 w-full rounded-xl bg-orange-500 px-5 py-3 font-black text-white disabled:opacity-40">{busy ? "Issuing…" : "Issue New Card"}</button>
        </section>
      )}
    </div>
  );
}
