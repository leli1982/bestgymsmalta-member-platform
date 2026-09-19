"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";

type StaffUser = {
  gymId: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
};

type AccessResult = {
  result: string;
  granted: boolean;
  duplicate?: boolean;
  scannedBarcode?: string;
  credentialKind?: string | null;
  cardStatus?: string | null;
  member?: {
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    photoRequired: boolean;
    photoUrl: string | null;
  } | null;
};

/**
 * A scanner configured to emit F9, then the card number, then Enter
 * can be distinguished from normal typing even when Staff edit a form.
 * Unprefixed keyboard-wedge scans are recognised only outside editable
 * controls, where rapid scanner input cannot corrupt a typed form.
 */
const SCANNER_PREFIX = "F9";
const MIN_UNPREFIXED_LENGTH = 7;
const MAX_AVERAGE_KEY_INTERVAL_MS = 65;

function heading(result: AccessResult) {
  if (result.granted) return "ACCESS GRANTED";
  if (result.result === "expired") return "MEMBERSHIP EXPIRED";
  if (result.result === "inactive") return "MEMBERSHIP INACTIVE";
  if (result.result === "disabled_card") return "CARD NOT ACTIVE";
  if (result.result === "ambiguous_card") return "CARD NUMBER AMBIGUOUS";
  if (result.result === "invalid_barcode") return "INVALID BARCODE";
  return "MEMBER NOT FOUND";
}

function playTone(granted: boolean) {
  try {
    const AudioClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioClass) return;
    const audio = new AudioClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = granted ? "sine" : "square";
    oscillator.frequency.value = granted ? 880 : 180;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.36);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.37);
    oscillator.onended = () => void audio.close();
  } catch {
    // The visual result is authoritative when the browser blocks audio.
  }
}

export default function StaffGlobalScanner() {
  const pathname = usePathname();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [result, setResult] = useState<AccessResult | null>(null);
  const [networkError, setNetworkError] = useState("");
  const [checking, setChecking] = useState(false);
  const scannerActive = useRef(false);
  const scannerBuffer = useRef("");
  const burstStart = useRef(0);
  const burstLast = useRef(0);
  const burstTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusBeforeScan = useRef<HTMLElement | null>(null);
  const requestSequence = useRef(0);
  const busy = useRef(false);
  const queuedCodes = useRef<string[]>([]);
  const processNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const readSession = async () => {
      try {
        const response = await fetch("/api/system/auth", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json();
        if (!cancelled) {
          setUser(response.ok && payload.authenticated ? (payload.user as StaffUser) : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    };
    const onAuthChanged = () => {
      void readSession();
    };
    void readSession();
    window.addEventListener("bgm-staff-auth-changed", onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("bgm-staff-auth-changed", onAuthChanged);
    };
  }, [pathname]);

  const canScan = Boolean(
    user?.gymId &&
      (user.isSuperAdmin || user.permissions.includes("barcode.scan"))
  );

  const verify = useCallback(async (code: string) => {
    if (!canScan || !code.trim()) return;
    setChecking(true);
    setNetworkError("");
    setResult(null);
    try {
      const response = await fetch("/api/system/barcode/scan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipNumber: code,
          deviceId: getOrCreateOfflineDeviceId(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "The card could not be verified.");
      }
      setResult(payload as AccessResult);
      playTone(Boolean(payload.granted));
      if (payload.granted && payload.member?.photoRequired) {
        window.setTimeout(() => playTone(false), 250);
      }
    } catch {
      setNetworkError("Unable to verify this card. Do not grant access until it is checked manually.");
      playTone(false);
    } finally {
      setChecking(false);
      busy.current = false;
      if (queuedCodes.current.length > 0) {
        // Keep every scan, even if another member scanned during verification.
        // A queued result appears after Staff dismiss the current result.
      }
    }
  }, [canScan]);

  const processNext = useCallback(() => {
    if (busy.current || result || networkError || checking) return;
    const code = queuedCodes.current.shift();
    if (!code) return;
    busy.current = true;
    void verify(code);
  }, [checking, networkError, result, verify]);

  processNextRef.current = processNext;

  const closeResult = useCallback(() => {
    setResult(null);
    setNetworkError("");
    setChecking(false);
    const previous = focusBeforeScan.current;
    if (previous?.isConnected) {
      window.setTimeout(() => previous.focus({ preventScroll: true }), 0);
    }
    window.setTimeout(() => processNextRef.current(), 0);
  }, []);

  useEffect(() => {
    if (!canScan) return;

    const clearTimer = () => {
      if (burstTimeout.current) clearTimeout(burstTimeout.current);
      burstTimeout.current = null;
    };
    const resetBuffer = () => {
      scannerActive.current = false;
      scannerBuffer.current = "";
      burstStart.current = 0;
      burstLast.current = 0;
      clearTimer();
    };
    const submit = (value: string) => {
      const code = value.trim();
      if (code.length < 3) return;
      queuedCodes.current.push(code);
      processNextRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === SCANNER_PREFIX || event.code === SCANNER_PREFIX) {
        if (!scannerActive.current) {
          focusBeforeScan.current = document.activeElement as HTMLElement | null;
        }
        scannerActive.current = true;
        scannerBuffer.current = "";
        clearTimer();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (scannerActive.current) {
        // The prefix makes scanner input distinguishable from Staff typing:
        // no part of the scan reaches the currently focused form field.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Enter") {
          const value = scannerBuffer.current;
          resetBuffer();
          submit(value);
        } else if (event.key === "Escape") {
          resetBuffer();
        } else if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          scannerBuffer.current += event.key;
          clearTimer();
          burstTimeout.current = setTimeout(resetBuffer, 4_000);
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const editable = target?.closest(
        "input, textarea, select, [contenteditable='true']"
      );
      // Without a scanner prefix, never intercept scans inside an editor:
      // a keyboard-wedge scan is otherwise indistinguishable from user typing.
      if (editable || event.ctrlKey || event.metaKey || event.altKey) {
        resetBuffer();
        return;
      }

      if (event.key === "Enter") {
        const code = scannerBuffer.current;
        const elapsed = burstLast.current - burstStart.current;
        const scannerLike = code.length >= MIN_UNPREFIXED_LENGTH &&
          elapsed / Math.max(1, code.length - 1) <= MAX_AVERAGE_KEY_INTERVAL_MS;
        resetBuffer();
        if (scannerLike) {
          focusBeforeScan.current = document.activeElement as HTMLElement | null;
          event.preventDefault();
          event.stopImmediatePropagation();
          submit(code);
        }
        return;
      }
      if (event.key.length !== 1) {
        resetBuffer();
        return;
      }
      const now = Date.now();
      if (!scannerBuffer.current || now - burstLast.current > 160) {
        scannerBuffer.current = "";
        burstStart.current = now;
      }
      scannerBuffer.current += event.key;
      burstLast.current = now;
      clearTimer();
      burstTimeout.current = setTimeout(resetBuffer, 160);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      resetBuffer();
    };
  }, [canScan]);

  useEffect(() => {
    if (!result && !networkError && !checking) processNextRef.current();
  }, [result, networkError, checking]);

  if (!canScan || (!result && !networkError && !checking)) return null;
  const granted = Boolean(result?.granted);
  const problem = Boolean(networkError);
  const color = problem ? "bg-amber-600" : granted ? "bg-emerald-600" : "bg-red-600";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={problem ? "SCAN VERIFICATION ERROR" : result ? heading(result) : "VERIFYING MEMBER"}
      className={\`fixed inset-0 z-[1000] flex items-center justify-center overflow-auto p-4 \${color}\`}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-9">
        {checking ? (
          <h2 className="text-3xl font-black text-zinc-900">VERIFYING MEMBER…</h2>
        ) : problem ? (
          <>
            <AlertTriangle className="mx-auto h-16 w-16 text-amber-600" />
            <h2 className="mt-3 text-3xl font-black text-amber-700">VERIFICATION UNAVAILABLE</h2>
            <p className="mt-4 text-lg font-bold text-zinc-800">{networkError}</p>
          </>
        ) : result ? (
          <>
            {granted ? (
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-red-600" />
            )}
            <h2 className={\`mt-3 text-4xl font-black sm:text-6xl \${granted ? "text-emerald-700" : "text-red-700"}\`}>
              {heading(result)}
            </h2>
            {result.member ? (
              <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-5 text-left">
                <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-5xl font-black text-zinc-300">
                  {result.member.fullName.slice(0, 1)}
                  {result.member.photoUrl && (
                    <img
                      src={result.member.photoUrl}
                      alt={\`\${result.member.fullName} photo\`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-black text-zinc-950">{result.member.fullName}</p>
                  <p className="mt-1 font-mono font-bold text-zinc-600">{result.member.memberNumber}</p>
                  <p className="mt-2 font-bold text-zinc-700">Expiry: {result.member.membershipExpiry || "Not set"}</p>
                  <p className="text-sm font-semibold text-zinc-500">Status: {result.member.status}</p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-lg font-bold text-red-800">
                This scanned identifier does not identify one verified active member.
              </p>
            )}
            {!granted && (
              <p className="mt-5 rounded-2xl bg-red-50 p-4 text-lg font-black text-red-800">
                DO NOT ALLOW ACCESS until verified by reception.
              </p>
            )}
            {granted && result.member?.photoRequired && (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-lg font-black text-amber-800">
                PHOTO REQUIRED — verify identity and capture the official photo when practical.
              </p>
            )}
            {granted && result.duplicate && (
              <p className="mt-3 font-semibold text-zinc-600">
                Recently checked in — no duplicate check-in recorded.
              </p>
            )}
          </>
        ) : null}
        {!checking && (
          <button
            type="button"
            onClick={closeResult}
            className="mt-7 w-full rounded-2xl bg-zinc-950 px-5 py-4 text-lg font-black text-white"
          >
            {queuedCodes.current.length > 0
              ? \`Close / Verify Next (\${queuedCodes.current.length} queued)\`
              : "Close / Return to Staff Task"}
          </button>
        )}
      </div>
    </div>
  );
}
