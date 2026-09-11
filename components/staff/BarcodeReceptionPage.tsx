"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OfficialMemberPhotoCapture from "@/components/staff/OfficialMemberPhotoCapture";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";

type SystemUser = {
  id: string;
  gymId: string | null;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type Gym = { id: string; name: string; status?: string };
type BarcodeResult =
  | "granted"
  | "expired"
  | "inactive"
  | "unknown_card"
  | "unknown_member"
  | "disabled_card"
  | "invalid_barcode"
  | "photo_required";

type ScanResponse = {
  result: BarcodeResult;
  granted: boolean;
  duplicate?: boolean;
  scanId?: string;
  scannedAt?: string;
  scannedBarcode?: string;
  cardStatus?: string | null;
  gym?: { id: string; name: string };
  member: null | {
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    enrollmentGymId: string | null;
    enrollmentGymName: string;
    hasPhoto: boolean;
    photoRequired: boolean;
    photoUrl: string | null;
  };
};

function presentation(result: BarcodeResult) {
  if (result === "granted") {
    return {
      title: "ACCESS GRANTED",
      severity: "success" as const,
      tone: "success" as const,
      autoResetMs: 3_500,
    };
  }
  if (result === "photo_required") {
    return {
      title: "PHOTO REQUIRED",
      severity: "photo" as const,
      tone: "warning" as const,
      autoResetMs: 0,
    };
  }
  if (result === "disabled_card") {
    return {
      title: "CARD REPLACED",
      severity: "warning" as const,
      tone: "warning" as const,
      autoResetMs: 0,
    };
  }
  if (result === "expired") {
    return {
      title: "MEMBERSHIP EXPIRED",
      severity: "warning" as const,
      tone: "warning" as const,
      autoResetMs: 0,
    };
  }
  if (result === "inactive") {
    return {
      title: "MEMBERSHIP INACTIVE",
      severity: "warning" as const,
      tone: "warning" as const,
      autoResetMs: 0,
    };
  }
  return {
    title: "MEMBER NOT FOUND",
    severity: "warning" as const,
    tone: "warning" as const,
    autoResetMs: 0,
  };
}

function playTone(kind: "success" | "warning") {
  try {
    const AudioContextClass =
      window.AudioContext ||
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
    // Sound is secondary; the full-screen visual result remains authoritative.
  }
}

export default function BarcodeReceptionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [user, setUser] = useState<SystemUser | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [finalizingPhoto, setFinalizingPhoto] = useState(false);
  const [error, setError] = useState("");

  const canScan = useMemo(
    () =>
      Boolean(user?.isSuperAdmin || user?.permissions.includes("barcode.scan")),
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
        setGyms(
          (gymsData.gyms || []).filter(
            (gym: Gym) => gym.status !== "coming_soon"
          )
        );
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
    setMembershipNumber("");
    setError("");
    setFinalizingPhoto(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function submitScan(rawValue = membershipNumber) {
    const scannedNumber = rawValue.trim();
    if (!scannedNumber || scanning) return;

    setScanning(true);
    setError("");

    try {
      const response = await fetch("/api/system/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipNumber: scannedNumber,
          gymId: user?.gymId ? undefined : selectedGymId,
          deviceId: getOrCreateOfflineDeviceId(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not process barcode scan.");
        setMembershipNumber("");
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      const scan = data as ScanResponse;
      setResult(scan);
      setMembershipNumber("");
      const view = presentation(scan.result);
      playTone(view.tone);

      if (view.autoResetMs) {
        resetTimer.current = setTimeout(resetScanner, view.autoResetMs);
      }
    } catch {
      setError("Could not reach the barcode scan service.");
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setScanning(false);
    }
  }

  async function finalizePhotoAccess() {
    if (!result?.scanId || !result.member || finalizingPhoto) return;

    setFinalizingPhoto(true);
    setError("");
    try {
      const response = await fetch("/api/system/barcode/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: result.scanId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Photo saved, but access could not be finalized.");
        return;
      }

      const nextResult = data.result as BarcodeResult;
      const memberId = result.member.id;
      setResult((current) =>
        current
          ? {
              ...current,
              result: nextResult,
              granted: data.granted === true,
              duplicate: data.duplicate === true,
              member: current.member
                ? {
                    ...current.member,
                    hasPhoto: true,
                    photoRequired: false,
                    photoUrl: `/api/system/members/photo/${encodeURIComponent(memberId)}?v=${Date.now()}`,
                  }
                : null,
            }
          : current
      );

      const view = presentation(nextResult);
      playTone(view.tone);
      if (view.autoResetMs) {
        resetTimer.current = setTimeout(resetScanner, view.autoResetMs);
      }
    } catch {
      setError("Photo saved, but access could not be finalized.");
    } finally {
      setFinalizingPhoto(false);
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
          <p className="mt-2 text-zinc-600">
            Sign in before opening Reception / Barcode.
          </p>
          <a
            href="/staff"
            className="mt-5 inline-flex rounded-xl bg-zinc-900 px-5 py-3 font-bold text-white"
          >
            Go to Staff Login
          </a>
        </div>
      </main>
    );
  }

  if (!canScan) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-900">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Reception access not permitted</h1>
          <p className="mt-2 text-zinc-600">
            This gym login does not have the barcode scan permission.
          </p>
          <a
            href="/staff"
            className="mt-5 inline-flex rounded-xl border border-zinc-300 px-5 py-3 font-bold"
          >
            Back to Staff
          </a>
        </div>
      </main>
    );
  }

  if (result) {
    const baseView = presentation(result.result);
    const view =
      result.result === "disabled_card" && result.cardStatus === "reserved"
        ? { ...baseView, title: "CARD NOT ACTIVE" }
        : baseView;
    const success = view.severity === "success";
    const needsPhoto = view.severity === "photo";
    const backgroundClass = success
      ? "bg-green-600"
      : needsPhoto
        ? "bg-amber-500"
        : "bg-red-600";
    const titleClass = success
      ? "text-green-600"
      : needsPhoto
        ? "text-amber-600"
        : "text-red-600";

    return (
      <main className={`flex min-h-screen items-center justify-center px-4 py-8 ${backgroundClass}`}>
        <div className="w-full max-w-4xl rounded-3xl bg-white p-7 text-zinc-900 shadow-2xl sm:p-10">
          <div className="text-center">
            <p className={`text-5xl font-black tracking-tight sm:text-7xl ${titleClass}`}>
              {view.title}
            </p>
            {result.duplicate && success && (
              <p className="mt-2 text-sm font-semibold text-zinc-500">
                Already checked in here recently — no duplicate check-in created.
              </p>
            )}
          </div>

          {result.member ? (
            <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
              <div>
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-zinc-100 text-6xl font-black text-zinc-300">
                  <span>{result.member.fullName.slice(0, 1).toUpperCase() || "?"}</span>
                  {result.member.photoUrl && (
                    <img
                      src={result.member.photoUrl}
                      alt={`${result.member.fullName} official photo`}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
                {result.member.photoRequired && result.result !== "photo_required" && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">
                    PHOTO REQUIRED BEFORE RENEWAL
                  </p>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-black sm:text-5xl">
                  {result.member.fullName}
                </h1>
                <p className="mt-2 text-xl font-bold text-zinc-500">
                  Card {result.member.memberNumber || result.scannedBarcode || "Not linked"}
                </p>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Detail
                    label="Expiry"
                    value={result.member.membershipExpiry || "No expiry date"}
                  />
                  <Detail
                    label="Enrollment Gym"
                    value={result.member.enrollmentGymName || "Not recorded"}
                  />
                  <Detail
                    label="Scanned At"
                    value={result.gym?.name || "BGM Gym"}
                  />
                  <Detail
                    label="Membership"
                    value={result.member.status.toUpperCase()}
                  />
                </dl>
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-xl font-bold text-zinc-700">
              MEMBER NOT FOUND
            </p>
          )}

          {needsPhoto && result.member && (
            <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
              <p className="text-center text-lg font-black text-amber-800">
                No check-in has been created yet. Capture the member&apos;s official photo to continue.
              </p>
              <div className="mx-auto mt-5 max-w-md">
                <OfficialMemberPhotoCapture
                  memberId={result.member.id}
                  source="reception_capture"
                  onSaved={() => void finalizePhotoAccess()}
                />
              </div>
              {finalizingPhoto && (
                <p className="mt-4 text-center text-sm font-bold text-amber-800">
                  Revalidating membership and finalizing access…
                </p>
              )}
            </div>
          )}

          {!success && !needsPhoto && (
            <div className="mt-8 rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center text-lg font-bold text-red-700">
              DO NOT ALLOW ACCESS until the membership/card issue is resolved.
            </div>
          )}

          <button
            onClick={resetScanner}
            disabled={finalizingPhoto}
            className="mt-8 w-full rounded-2xl bg-zinc-900 px-5 py-4 text-lg font-black text-white disabled:opacity-40"
          >
            {success
              ? "Scan Next Member"
              : needsPhoto
                ? "Cancel / Scan Next Member"
                : "Clear Warning / Scan Next"}
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
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-500">
              BestGymsMalta
            </p>
            <h1 className="mt-1 text-3xl font-black">Reception / Barcode</h1>
            <p className="mt-1 text-zinc-400">{user.displayName}</p>
          </div>
          <a
            href="/staff"
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold"
          >
            Back to Staff
          </a>
        </header>

        {user.isSuperAdmin && !user.gymId && (
          <label className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm font-bold">
            Scan at gym
            <select
              value={selectedGymId}
              onChange={(event) => setSelectedGymId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            >
              <option value="">Select gym</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-xl sm:p-10">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-orange-500 text-4xl">
            |||
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-tight">READY TO SCAN</h2>
          <p className="mt-2 text-zinc-400">
            Scan the physical BGM card or the matching virtual barcode in the member app.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitScan();
            }}
            className="mx-auto mt-8 max-w-lg"
          >
            <input
              ref={inputRef}
              value={membershipNumber}
              onChange={(event) => setMembershipNumber(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              disabled={scanning || (!user.gymId && !selectedGymId)}
              className="w-full rounded-2xl border-2 border-zinc-700 bg-zinc-950 px-5 py-4 text-center text-xl font-bold tracking-wider outline-none focus:border-orange-500 disabled:opacity-40"
              placeholder={
                !user.gymId && !selectedGymId
                  ? "Select gym first"
                  : "Barcode scanner input"
              }
            />
            <button
              disabled={scanning || !membershipNumber.trim()}
              className="mt-3 rounded-xl bg-orange-500 px-6 py-3 font-black text-white disabled:opacity-40"
            >
              {scanning ? "Checking…" : "Process Barcode"}
            </button>
          </form>

          {error && (
            <div className="mx-auto mt-5 max-w-lg rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm font-semibold text-red-200">
              {error}
            </div>
          )}
          <p className="mt-5 text-xs text-zinc-500">
            The exact physical-card barcode can also be typed manually for setup/testing.
          </p>
        </section>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  );
}
