"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, CheckCircle2, XCircle } from "lucide-react";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";

type SystemUser = {
  id: string;
  gymId: string | null;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type ScanResponse = {
  result:
    | "granted"
    | "expired"
    | "inactive"
    | "unknown_card"
    | "unknown_member"
    | "disabled_card"
    | "invalid_barcode";
  granted: boolean;
  duplicate?: boolean;
  scannedBarcode?: string;
  credentialKind?: "physical_card" | "member_number" | null;
  cardStatus?: string | null;
  gym?: { id: string; name: string };
  member: null | {
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    enrollmentGymName: string;
    photoRequired: boolean;
    photoUrl: string | null;
  };
};

function resultTitle(result: ScanResponse) {
  if (result.granted) return "ACCESS GRANTED";
  if (result.result === "expired") return "MEMBERSHIP EXPIRED";
  if (result.result === "inactive") return "MEMBERSHIP INACTIVE";
  if (result.result === "disabled_card") return "CARD NOT ACTIVE";
  return "MEMBER NOT FOUND";
}

export default function StaffHomeScanner({ user }: { user: SystemUser }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerBuffer = useRef("");
  const scannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const canScan =
    Boolean(user.gymId) &&
    (user.isSuperAdmin || user.permissions.includes("barcode.scan"));

  function reset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    setResult(null);
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
      setResult(scan);
      setValue("");
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

  useEffect(() => {
    if (canScan) inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!canScan || result || scanning) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "Enter") {
        const scanned = scannerBuffer.current;
        scannerBuffer.current = "";
        if (scannerTimer.current) clearTimeout(scannerTimer.current);
        scannerTimer.current = null;
        if (scanned) {
          event.preventDefault();
          void submitScan(scanned);
        }
        return;
      }

      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      scannerBuffer.current += event.key;
      if (scannerTimer.current) clearTimeout(scannerTimer.current);
      scannerTimer.current = setTimeout(() => {
        scannerBuffer.current = "";
        scannerTimer.current = null;
      }, 160);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (scannerTimer.current) clearTimeout(scannerTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [canScan, result, scanning]);

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
          className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${
            result.granted ? "bg-emerald-600" : "bg-red-600"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={resultTitle(result)}
        >
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
            {result.granted ? (
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-red-600" />
            )}
            <h2
              className={`mt-3 text-4xl font-black sm:text-6xl ${
                result.granted ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {resultTitle(result)}
            </h2>

            {result.member ? (
              <div className="mx-auto mt-6 max-w-xl">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-3xl font-black text-zinc-300">
                    {result.member.fullName.slice(0, 1).toUpperCase()}
                    {result.member.photoUrl && (
                      <img
                        src={result.member.photoUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black text-zinc-950">
                      {result.member.fullName}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-zinc-500">
                      {result.member.memberNumber}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                      Scanned via{" "}
                      {result.credentialKind === "physical_card"
                        ? "physical card"
                        : "BGM member number"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-2xl bg-zinc-100 p-4">
                    <p className="text-xs font-bold text-zinc-500">Expiry</p>
                    <p className="mt-1 font-black">
                      {result.member.membershipExpiry || "Not set"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-100 p-4">
                    <p className="text-xs font-bold text-zinc-500">Scanned value</p>
                    <p className="mt-1 break-all font-mono font-black">
                      {result.scannedBarcode || "—"}
                    </p>
                  </div>
                </div>

                {result.granted && result.member.photoRequired && (
                  <div className="mt-5 rounded-2xl border-4 border-amber-300 bg-amber-50 p-4">
                    <p className="text-2xl font-black text-amber-700">PHOTO REQUIRED</p>
                    <p className="mt-1 text-sm font-bold text-amber-900">
                      Entry is still granted. Use Card / Reception when practical to capture the official photo.
                    </p>
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
              className="mt-7 w-full rounded-2xl bg-zinc-950 px-5 py-4 text-lg font-black text-white"
            >
              {result.granted ? "Close / Scan Next" : "Clear Warning / Scan Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
