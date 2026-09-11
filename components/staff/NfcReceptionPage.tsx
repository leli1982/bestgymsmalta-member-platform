"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";
import { nfcReceptionPresentation } from "@/lib/nfcReceptionCore";
import type { NfcAccessResult } from "@/lib/nfcAccessCore";

type SystemUser = {
  id: string;
  gymId: string | null;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type Gym = { id: string; name: string; status?: string };

type ScanResponse = {
  result: NfcAccessResult;
  granted: boolean;
  duplicate?: boolean;
  scannedAt?: string;
  gym?: { id: string; name: string };
  member: null | {
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    enrollmentGymId: string | null;
    enrollmentGymName: string;
    officialPhotoPath: string | null;
  };
};

function playTone(kind: "success" | "warning") {
  try {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);

    const oscillator = context.createOscillator();
    oscillator.connect(gain);
    oscillator.type = kind === "success" ? "sine" : "square";
    oscillator.frequency.setValueAtTime(
      kind === "success" ? 880 : 220,
      context.currentTime
    );
    if (kind === "warning") {
      oscillator.frequency.setValueAtTime(165, context.currentTime + 0.15);
    }
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
    oscillator.onended = () => void context.close();
  } catch {
    // Sound is a convenience only; visual access state remains authoritative.
  }
}

export default function NfcReceptionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [uid, setUid] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const canScan = useMemo(
    () => Boolean(user?.isSuperAdmin || user?.permissions.includes("nfc.scan")),
    [user]
  );

  useEffect(() => {
    async function initialize() {
      try {
        const [authResponse, gymsResponse] = await Promise.all([
          fetch("/api/system/auth", { cache: "no-store" }),
          fetch("/api/gyms", { cache: "no-store" }),
        ]);
        const authData = await authResponse.json();
        const gymsData = await gymsResponse.json();
        const activeUser = authData.authenticated ? authData.user : null;
        setUser(activeUser);
        setGyms((gymsData.gyms || []).filter((gym: Gym) => gym.status !== "coming_soon"));
        if (activeUser?.gymId) setSelectedGymId(activeUser.gymId);
      } catch {
        setError("Could not load the reception session.");
      } finally {
        setLoading(false);
      }
    }

    void initialize();
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!loading && canScan && !result) inputRef.current?.focus();
  }, [loading, canScan, result]);

  function resetScanner() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    setResult(null);
    setUid("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function submitScan(rawUid = uid) {
    const cardUid = rawUid.trim();
    if (!cardUid || scanning) return;

    setScanning(true);
    setError("");

    try {
      const response = await fetch("/api/system/nfc/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardUid,
          gymId: user?.gymId ? undefined : selectedGymId,
          deviceId: getOrCreateOfflineDeviceId(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not process NFC scan.");
        setUid("");
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      const scan = data as ScanResponse;
      setResult(scan);
      setUid("");
      const presentation = nfcReceptionPresentation(scan.result);
      playTone(presentation.tone);

      if (presentation.autoResetMs) {
        resetTimer.current = setTimeout(resetScanner, presentation.autoResetMs);
      }
    } catch {
      setError("Could not reach the NFC scan service.");
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        Loading reception…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-900">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Staff login required</h1>
          <p className="mt-2 text-zinc-600">Sign in before opening Reception / NFC.</p>
          <a href="/staff" className="mt-5 inline-flex rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white">Go to Staff Login</a>
        </div>
      </main>
    );
  }

  if (!canScan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-900">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Reception access not permitted</h1>
          <p className="mt-2 text-zinc-600">This gym login does not have the NFC scan permission.</p>
          <a href="/staff" className="mt-5 inline-flex rounded-xl border border-zinc-300 px-5 py-3 font-bold">Back to Staff</a>
        </div>
      </main>
    );
  }

  if (result) {
    const presentation = nfcReceptionPresentation(result.result);
    const success = presentation.severity === "success";

    return (
      <main className={`flex min-h-screen items-center justify-center px-4 py-8 ${success ? "bg-green-600" : "bg-red-600"}`}>
        <div className="w-full max-w-4xl rounded-3xl bg-white p-7 text-zinc-900 shadow-2xl sm:p-10">
          <div className="text-center">
            <p className={`text-5xl font-black tracking-tight sm:text-7xl ${success ? "text-green-600" : "text-red-600"}`}>
              {presentation.title}
            </p>
            {result.duplicate && success && (
              <p className="mt-2 text-sm font-semibold text-zinc-500">Already checked in here recently — no duplicate check-in created.</p>
            )}
          </div>

          {result.member ? (
            <div className="mt-8 grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
              <div className="flex aspect-square items-center justify-center rounded-3xl bg-zinc-100 text-6xl font-black text-zinc-300">
                {result.member.fullName.slice(0, 1).toUpperCase() || "?"}
              </div>
              <div>
                <h1 className="text-4xl font-black sm:text-5xl">{result.member.fullName}</h1>
                <p className="mt-2 text-xl font-bold text-zinc-500">{result.member.memberNumber}</p>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Detail label="Expiry" value={result.member.membershipExpiry || "No expiry date"} />
                  <Detail label="Enrollment Gym" value={result.member.enrollmentGymName || "Not recorded"} />
                  <Detail label="Scanned At" value={result.gym?.name || "BGM Gym"} />
                  <Detail label="Membership" value={result.member.status.toUpperCase()} />
                </dl>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-xl font-bold text-zinc-700">This NFC card is not recognised in the BGM system.</p>
          )}

          {!success && (
            <div className="mt-8 rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center text-lg font-bold text-red-700">
              DO NOT ALLOW ACCESS until the membership/card issue is resolved.
            </div>
          )}

          <button onClick={resetScanner} className="mt-8 w-full rounded-2xl bg-zinc-900 px-5 py-4 text-lg font-black text-white">
            {success ? "Scan Next Member" : "Clear Warning / Scan Next"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-500">BestGymsMalta</p>
            <h1 className="mt-1 text-3xl font-black">Reception / NFC</h1>
            <p className="mt-1 text-zinc-400">{user.displayName}</p>
          </div>
          <a href="/staff" className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold">Back to Staff</a>
        </header>

        {user.isSuperAdmin && !user.gymId && (
          <label className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm font-bold">
            Scan at gym
            <select value={selectedGymId} onChange={(e) => setSelectedGymId(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white">
              <option value="">Select gym</option>
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
            </select>
          </label>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-xl sm:p-10">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-orange-500 text-4xl">◉</div>
          <h2 className="mt-5 text-4xl font-black tracking-tight">READY TO SCAN</h2>
          <p className="mt-2 text-zinc-400">Tap the member&apos;s NFC card on the reception reader.</p>

          <form onSubmit={(event) => { event.preventDefault(); void submitScan(); }} className="mx-auto mt-8 max-w-lg">
            <input
              ref={inputRef}
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={scanning || (!user.gymId && !selectedGymId)}
              className="w-full rounded-2xl border-2 border-zinc-700 bg-zinc-950 px-5 py-4 text-center text-xl font-bold tracking-wider outline-none focus:border-orange-500 disabled:opacity-40"
              placeholder={!user.gymId && !selectedGymId ? "Select gym first" : "NFC reader input"}
            />
            <button disabled={scanning || !uid.trim()} className="mt-3 rounded-xl bg-orange-500 px-6 py-3 font-black text-white disabled:opacity-40">
              {scanning ? "Checking…" : "Process Card"}
            </button>
          </form>

          {error && <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm font-semibold text-red-200">{error}</div>}
          <p className="mt-5 text-xs text-zinc-500">The field also accepts a UID typed manually for setup/testing.</p>
        </section>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  );
}
