"use client";

import { formatEuropeanDate } from "@/lib/europeanDate";

import { useEffect, useRef, useState } from "react";
import { Barcode, CheckCircle2, XCircle } from "lucide-react";
import OfficialMemberPhotoCapture from "@/components/staff/OfficialMemberPhotoCapture";
import CardConflictCards, { type CardConflictMember } from "@/components/staff/CardConflictCards";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";

type SystemUser = {
  id: string;
  gymId: string | null;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type ScanResponse = {
  scanId?: string;
  cardMatches?: CardConflictMember[];
  result:
    | "granted"
    | "expired"
    | "inactive"
    | "unknown_card"
    | "unknown_member"
    | "disabled_card"
    | "invalid_barcode"
    | "ambiguous_card";
  granted: boolean;
  duplicate?: boolean;
  scannedBarcode?: string;
  credentialKind?: "physical_card" | "member_number" | "legacy_pk_customer" | null;
  currentPhysicalCard?: string | null;
  currentPhysicalCardSource?: "credential" | "legacy_scan3" | null;
  legacyMatches?: Array<{
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
  }>;
  cardStatus?: string | null;
  gym?: { id: string; name: string };
  member: null | {
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    enrollmentGymName: string;
    legacyGym?: string | null;
    photoRequired: boolean;
    photoUrl: string | null;
  };
};

function resultTitle(result: ScanResponse) {
  if (result.granted) return "ACCESS GRANTED";
  if (result.cardMatches?.length) return "SHARED CARD CONFLICT";
  if (result.result === "expired") return "MEMBERSHIP EXPIRED";
  if (result.result === "inactive") return "MEMBERSHIP INACTIVE";
  if (result.result === "disabled_card") return "CARD REPLACED";
  if (result.result === "ambiguous_card") return "DUPLICATE LEGACY NUMBER";
  return "MEMBER NOT FOUND";
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
    // The full-screen visual result remains authoritative if audio is unavailable.
  }
}

export default function StaffHomeScanner({ user }: { user: SystemUser }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const canScan =
    Boolean(user.gymId) &&
    (user.isSuperAdmin || user.permissions.includes("barcode.scan"));

  function reset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    setResult(null);
    setPhotoLoadFailed(false);
    setValue("");
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function submitScan(rawValue: string) {
    const scanned = rawValue.trim();
    if (!canScan || !scanned || scanning) return;

    setScanning(true);
    setError("");
    try {
      const response = await fetch("/api/system/barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipNumber: scanned,
          deviceId: getOrCreateOfflineDeviceId(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not process barcode scan.");
        setValue("");
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      const scan = data as ScanResponse;
      setPhotoLoadFailed(false);
      setResult(scan);
      setValue("");
      playTone(scan.granted ? "success" : "warning");
      if (scan.granted && scan.member?.photoRequired) {
        window.setTimeout(() => playTone("warning"), 220);
      }
      if (scan.granted && !scan.member?.photoRequired) {
        resetTimer.current = window.setTimeout(reset, 3500);
      }
    } catch {
      setError("Could not reach the barcode scan service.");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setScanning(false);
    }
  }

  // The portal-wide scanner owns hardware keystrokes on every Staff route.
  // Keep this home input only for deliberate manual entry.
  useEffect(() => {
    if (canScan) inputRef.current?.focus();
  }, [canScan]);

  if (!canScan) return null;

  return (
    <>
      <section className="mt-5 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Barcode className="h-7 w-7" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Reception scanner
              </p>
              <h2 className="text-xl font-black text-zinc-950">READY TO SCAN</h2>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Physical card barcode or permanent BGM member number.
              </p>
            </div>
          </div>

          <form
            className="flex w-full gap-2 lg:max-w-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void submitScan(value);
            }}
          >
            <input
              ref={inputRef}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              data-bgm-scan-input="true"
              placeholder="Barcode scanner input"
              className="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-mono text-base font-bold outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={scanning || !value.trim()}
              className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              {scanning ? "Checking…" : "Scan"}
            </button>
          </form>
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
      </section>

      {result && (
        <div
          className={`fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4 ${
            result.granted ? "bg-emerald-600" : "bg-red-600"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={resultTitle(result)}
        >
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl sm:p-6">
            {result.granted ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-red-600" />
            )}
            <h2
              className={`mt-2 text-3xl font-black sm:text-5xl ${
                result.granted ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {resultTitle(result)}
            </h2>

            {Boolean(result.cardMatches?.length) && <CardConflictCards members={result.cardMatches || []} scanId={result.scanId} />}
            {result.result === "ambiguous_card" && !result.cardMatches?.length && (result.legacyMatches || []).length > 0 && (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-left">
                <p className="text-sm font-black uppercase tracking-wide text-red-700">
                  More than one active legacy member uses this old number
                </p>
                <p className="mt-1 text-sm font-semibold text-red-900">
                  No entry was granted. Search the member by name/BGM number and verify them manually.
                </p>
                <div className="mt-3 grid gap-2">
                  {(result.legacyMatches || []).map((candidate) => (
                    <div key={candidate.id} className="rounded-xl bg-white p-3">
                      <p className="font-black text-zinc-950">{candidate.fullName}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-zinc-500">
                        {candidate.memberNumber} · {formatEuropeanDate(candidate.membershipExpiry, "No expiry date")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.member ? (
              <div className="mx-auto mt-4 max-w-5xl">
                <div className="grid gap-5 text-left lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)] lg:items-center">
                  <div
                    data-testid="staff-home-scan-photo"
                    className="relative mx-auto flex aspect-square w-full max-w-[460px] items-center justify-center overflow-hidden rounded-3xl bg-zinc-100 text-8xl font-black text-zinc-300 shadow-inner"
                  >
                    {result.member.fullName.slice(0, 1).toUpperCase()}
                    {result.member.photoUrl && !photoLoadFailed && (
                      <img
                        src={result.member.photoUrl}
                        alt=""
                        onError={() => {
                          if (resetTimer.current) clearTimeout(resetTimer.current);
                          resetTimer.current = null;
                          setPhotoLoadFailed(true);
                        }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xl font-black text-zinc-950 sm:text-4xl">
                      {result.member.fullName}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-zinc-500">
                      {result.member.memberNumber}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Scanned via{" "}
                      {result.credentialKind === "physical_card"
                        ? "physical card"
                        : result.credentialKind === "legacy_pk_customer"
                          ? "legacy pkCustomer"
                          : "BGM member number"}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm font-semibold text-zinc-600 sm:grid-cols-2">
                      <p>Current enrollment gym: <strong className="text-zinc-900">{result.member.enrollmentGymName || "Not recorded"}</strong></p>
                      <p>Legacy gym: <strong className="text-zinc-900">{result.member.legacyGym || "Not recorded"}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-left sm:grid-cols-3">
                  <div className="rounded-2xl bg-zinc-100 p-4">
                    <p className="text-xs font-bold text-zinc-500">Expiry</p>
                    <p className="mt-1 font-black">
                      {formatEuropeanDate(result.member.membershipExpiry, "Not set")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-100 p-4">
                    <p className="text-xs font-bold text-zinc-500">Current physical card</p>
                    <p className="mt-1 break-all font-mono font-black">
                      {result.currentPhysicalCard || "Not assigned"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-100 p-4">
                    <p className="text-xs font-bold text-zinc-500">Scanned value</p>
                    <p className="mt-1 break-all font-mono font-black">
                      {result.scannedBarcode || "—"}
                    </p>
                  </div>
                </div>

                {result.granted && (result.member.photoRequired || photoLoadFailed) && (
                  <div className="mt-4 grid gap-4 rounded-2xl border-4 border-amber-300 bg-amber-50 p-4 text-left lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center">
                    <div>
                      <p className="text-2xl font-black text-amber-700">PHOTO REQUIRED</p>
                      <p className="mt-1 text-sm font-bold text-amber-900">
                        Entry is still granted. This warning stays open until Staff take an official photo or cancel to scan the next member.
                      </p>
                    </div>
                    <div className="min-w-0">
                      <OfficialMemberPhotoCapture
                        memberId={result.member.id}
                        source="reception_capture"
                        onSaved={(photoUrl) => {
                          const memberId = result.member?.id;
                          setPhotoLoadFailed(false);
                          setResult(current => current?.member && current.member.id === memberId
                            ? { ...current, member: { ...current.member, photoRequired: false, photoUrl } }
                            : current);
                          if (resetTimer.current) clearTimeout(resetTimer.current);
                          resetTimer.current = window.setTimeout(reset, 3500);
                        }}
                      />
                    </div>
                  </div>
                )}

                {result.duplicate && result.granted && (
                  <p className="mt-4 text-sm font-bold text-zinc-500">
                    Already checked in recently — no duplicate check-in was created.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-6 text-xl font-black text-zinc-700">
                The scanned identifier is not linked to a member.
              </p>
            )}

            <button
              type="button"
              onClick={reset}
              className="mt-4 w-full rounded-2xl bg-zinc-950 px-5 py-3 text-lg font-black text-white"
            >
              {result.granted && result.member && (result.member.photoRequired || photoLoadFailed)
                ? "Cancel / Scan Next"
                : result.granted
                  ? "Close / Scan Next"
                  : "Clear Warning / Scan Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
