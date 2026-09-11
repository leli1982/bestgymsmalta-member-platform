"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadOfflineRoster,
  registerStaffServiceWorker,
  syncOfflineRoster,
  type OfflineRosterSnapshot,
} from "@/lib/offlineRosterClient";
import {
  filterOfflineRoster,
  offlineRosterAgeState,
} from "@/lib/offlineRosterSearch";

export default function OfflineRosterPage() {
  const [snapshot, setSnapshot] = useState<OfflineRosterSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadLocal() {
    try {
      setSnapshot(await loadOfflineRoster());
    } catch {
      setSnapshot(null);
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void registerStaffServiceWorker();
    void loadLocal();

    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  async function refresh() {
    setSyncing(true);
    setMessage("");
    try {
      const next = await syncOfflineRoster();
      setSnapshot({ id: "active-members", ...next });
      setMessage("Offline roster updated.");
    } catch {
      setMessage("Could not refresh. The saved offline copy is still available.");
    } finally {
      setSyncing(false);
    }
  }

  const results = useMemo(
    () => filterOfflineRoster(snapshot?.members || [], query).slice(0, 100),
    [snapshot, query]
  );

  const ageState = snapshot
    ? offlineRosterAgeState(snapshot.generatedAt)
    : "very_old";

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
              <h1 className="mt-1 text-2xl font-bold">Emergency Offline Member Lookup</h1>
              <p className="mt-2 text-sm text-zinc-600">This local copy contains only active members&apos; membership numbers and names.</p>
            </div>
            <div className={`rounded-full px-3 py-2 text-xs font-bold ${online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {online ? "ONLINE" : "OFFLINE MODE"}
            </div>
          </div>
        </header>

        {!snapshot ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            No offline roster has been saved on this computer yet. Sign in while online and allow the first sync to complete.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Last synced</p>
                  <p className="font-bold">{new Date(snapshot.generatedAt).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-zinc-500">{snapshot.memberCount} active members in this local copy</p>
                </div>
                <div className={`rounded-xl px-3 py-2 text-sm font-bold ${ageState === "current" ? "bg-green-100 text-green-700" : ageState === "old" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}`}>
                  {ageState === "current" ? "Current copy" : ageState === "old" ? "Copy is over 24 hours old" : "WARNING: copy is over 3 days old"}
                </div>
              </div>

              {online && (
                <button onClick={refresh} disabled={syncing} className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {syncing ? "Refreshing…" : "Refresh Now"}
                </button>
              )}
              {message && <p className="mt-3 text-sm text-zinc-600">{message}</p>}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <label className="block text-sm font-bold">Search member
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg outline-none focus:border-orange-500" placeholder="Membership number or name" />
              </label>

              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                <div className="grid grid-cols-[minmax(120px,180px)_1fr] bg-zinc-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  <span>Member No.</span><span>Name</span>
                </div>
                {results.map((member) => (
                  <div key={member.memberNumber} className="grid grid-cols-[minmax(120px,180px)_1fr] border-t border-zinc-100 px-4 py-3 text-sm">
                    <span className="font-bold">{member.memberNumber}</span>
                    <span>{member.fullName}</span>
                  </div>
                ))}
                {results.length === 0 && <div className="px-4 py-8 text-center text-sm text-zinc-500">No matching member found in the saved roster.</div>}
              </div>
              {filterOfflineRoster(snapshot.members, query).length > 100 && <p className="mt-3 text-xs text-zinc-500">Showing the first 100 matches. Refine your search.</p>}
            </section>
          </>
        )}

        <a href="/staff" className="inline-flex rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">Back to Staff</a>
      </div>
    </main>
  );
}
