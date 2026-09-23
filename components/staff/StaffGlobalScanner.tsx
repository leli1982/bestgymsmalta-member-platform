"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { getOrCreateOfflineDeviceId } from "@/lib/offlineRosterClient";
import OfficialMemberPhotoCapture from "@/components/staff/OfficialMemberPhotoCapture";
import { looksLikeKeyboardBarcode, shouldHoldScannerCandidate, MAX_CONTIGUOUS_GAP_MS } from "@/lib/staffKeyboardScanCore";

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
    id: string;
    memberNumber: string;
    fullName: string;
    status: string;
    membershipExpiry: string | null;
    photoRequired: boolean;
    photoUrl: string | null;
  } | null;
};

/**
 * Keep explicit F9 support and recognise fast unprefixed scans from ordinary
 * USB scanners. Text fields are snapshotted and restored for recognised scans.
 * Quantity/number fields temporarily buffer typed keys so scanner digits never
 * enter the form. Date/password/contenteditable controls use Scan card fallback.
 */
const SCANNER_PREFIX = "F9";

type ScannerEditable = HTMLInputElement | HTMLTextAreaElement;
type EditableBurst = {
  field: ScannerEditable;
  originalValue: string;
  originalStart: number | null;
  originalEnd: number | null;
  held: string;
  numeric: boolean;
};

function activeScannerEditable(target: EventTarget | null): ScannerEditable | null {
  if (!(target instanceof HTMLElement)) return null;
  const field = target.closest("input,textarea");
  if (field instanceof HTMLTextAreaElement) return field;
  if (!(field instanceof HTMLInputElement)) return null;
  if (!["text", "search", "email", "tel", "url", "number"].includes(field.type)) return null;
  if (field.dataset.bgmScanInput === "true" || /scan.*(card|barcode)|barcode scanner/i.test(field.placeholder)) {
    return null; // Dedicated card inputs own their own scanner keystrokes.
  }
  return field;
}

function dispatchEditableInput(field: ScannerEditable) {
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function restoreEditableInput(burst: EditableBurst) {
  if (!burst.field.isConnected) return;
  const proto = burst.field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  // Use the native setter to notify React's controlled input tracker properly.
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(burst.field, burst.originalValue);
  else burst.field.value = burst.originalValue;
  if (burst.originalStart !== null && burst.originalEnd !== null) {
    burst.field.setSelectionRange(burst.originalStart, burst.originalEnd);
  }
  // All keystrokes are held in number inputs, so the value and React state
  // were never changed during a scan. Do not dispatch a synthetic input event.
  if (!burst.numeric) dispatchEditableInput(burst.field);
}

function replayHeldKeys(burst: EditableBurst | null) {
  if (!burst?.held || !burst.field.isConnected) return;
  if (burst.numeric && burst.field instanceof HTMLInputElement) {
    // setRangeText/selectionStart are unsupported on type=number inputs.
    // Use the native setter so React sees a genuine change when normal human
    // quantity typing is replayed after the short scanner-detection window.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const nextValue = burst.field.value + burst.held;
    if (setter) setter.call(burst.field, nextValue);
    else burst.field.value = nextValue;
    dispatchEditableInput(burst.field);
    return;
  }
  const position = burst.field.selectionStart ?? burst.field.value.length;
  const end = burst.field.selectionEnd ?? position;
  burst.field.setRangeText(burst.held, position, end, "end");
  dispatchEditableInput(burst.field);
}

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
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [manualScanOpen, setManualScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const editableBurst = useRef<EditableBurst | null>(null);
  const scannerActive = useRef(false);
  const scannerBuffer = useRef("");
  const burstStart = useRef(0);
  const burstLast = useRef(0);
  const burstTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusBeforeScan = useRef<HTMLElement | null>(null);
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
    setPhotoLoadFailed(false);
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

  useEffect(() => {
    if (manualScanOpen) manualInputRef.current?.focus();
  }, [manualScanOpen]);

  const submitManualScan = (event: React.FormEvent) => {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualScanOpen(false);
    setManualCode("");
    queuedCodes.current.push(code);
    processNextRef.current();
  };

  const closeResult = useCallback(() => {
    setResult(null);
    setPhotoLoadFailed(false);
    setNetworkError("");
    setChecking(false);
    const previous = focusBeforeScan.current;
    if (previous?.isConnected) {
      // Restore immediately, before the next form keystroke arrives.
      previous.focus({ preventScroll: true });
    }
    window.setTimeout(() => processNextRef.current(), 0);
  }, []);

  useEffect(() => {
    if (!canScan || pathname.startsWith("/staff/reception") || manualScanOpen) return;

    const clearTimer = () => {
      if (burstTimeout.current) clearTimeout(burstTimeout.current);
      burstTimeout.current = null;
    };
    const resetBuffer = (replay = true) => {
      if (replay) replayHeldKeys(editableBurst.current);
      editableBurst.current = null;
      scannerActive.current = false;
      scannerBuffer.current = "";
      burstStart.current = 0;
      burstLast.current = 0;
      clearTimer();
    };
    const submit = (value: string) => {
      const code = value.trim();
      if (!code) return;
      queuedCodes.current.push(code);
      processNextRef.current();
    };
    const stopKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.key === "Dead") {
        resetBuffer();
        return;
      }
      if (event.key === SCANNER_PREFIX || event.code === SCANNER_PREFIX) {
        // Prefixed scanners are always unambiguous: no text enters the editor.
        resetBuffer();
        focusBeforeScan.current = document.activeElement as HTMLElement | null;
        scannerActive.current = true;
        stopKey(event);
        return;
      }
      if (scannerActive.current) {
        stopKey(event);
        if (event.key === "Enter") {
          const code = scannerBuffer.current;
          resetBuffer(false);
          submit(code);
        } else if (event.key === "Escape") {
          resetBuffer(false);
        } else if (
          event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        ) {
          scannerBuffer.current += event.key;
          clearTimer();
          burstTimeout.current = setTimeout(() => resetBuffer(false), 4000);
        }
        return;
      }

      const field = activeScannerEditable(event.target);
      const target = event.target as HTMLElement | null;
      const insideEditable = Boolean(target?.closest("input,textarea,select,[contenteditable='true']"));
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
        resetBuffer();
        return;
      }
      if (insideEditable && !field) {
        // This is a dedicated scanner input or an unsupported editor. Leave
        // its native behaviour alone and offer the Scan card fallback.
        resetBuffer();
        return;
      }

      if (event.key === "Enter") {
        const code = scannerBuffer.current;
        const lastGapMs = burstLast.current > 0 ? Date.now() - burstLast.current : Infinity;
        const scannerLike = looksLikeKeyboardBarcode(
          code, burstLast.current - burstStart.current, lastGapMs,
        );
        const burst = editableBurst.current;
        if (scannerLike) {
          if (burst) restoreEditableInput(burst);
          focusBeforeScan.current = (burst?.field ?? document.activeElement) as HTMLElement | null;
          stopKey(event);
          resetBuffer(false);
          submit(code);
        } else {
          resetBuffer();
        }
        return;
      }

      if (event.key === "Escape" || event.key.length !== 1) {
        resetBuffer();
        return;
      }
      if (!/^[a-z0-9_-]$/i.test(event.key)) {
        resetBuffer();
        return;
      }

      const now = Date.now();
      const lastGapMs = burstLast.current ? now - burstLast.current : 0;
      if (!scannerBuffer.current || lastGapMs > MAX_CONTIGUOUS_GAP_MS ||
          (editableBurst.current && editableBurst.current.field !== field)) {
        resetBuffer();
        burstStart.current = now;
        if (field) {
          editableBurst.current = {
            field,
            originalValue: field.value,
            originalStart: field.type === "number" ? null : field.selectionStart,
            originalEnd: field.type === "number" ? null : field.selectionEnd,
            held: "",
            numeric: field.type === "number",
          };
        }
      }
      const nextCode = scannerBuffer.current + event.key;
      const elapsedMs = now - burstStart.current;
      // Protect number inputs from the FIRST digit: scanners would otherwise
      // mutate quantity/cash React state before the barcode is recognised.
      // Text inputs keep the earlier four-key threshold to minimise typing lag.
      if (field && editableBurst.current &&
          (editableBurst.current.numeric || editableBurst.current.held ||
            shouldHoldScannerCandidate(nextCode.length, elapsedMs, lastGapMs))) {
        editableBurst.current.held += event.key;
        stopKey(event);
      }
      scannerBuffer.current = nextCode;
      burstLast.current = now;
      clearTimer();
      burstTimeout.current = setTimeout(() => resetBuffer(), MAX_CONTIGUOUS_GAP_MS);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      resetBuffer();
    };
  }, [canScan, pathname, manualScanOpen]);

  useEffect(() => {
    if (!result && !networkError && !checking) processNextRef.current();
  }, [result, networkError, checking]);

  if (!canScan || pathname.startsWith("/staff/reception")) return null;
  const granted = Boolean(result?.granted);
  const problem = Boolean(networkError);
  const color = problem ? "bg-amber-600" : granted ? "bg-emerald-600" : "bg-red-600";

  return (
    <>
      {!result && !networkError && !checking && !manualScanOpen && (
        <button
          type="button"
          onClick={() => {
            focusBeforeScan.current = document.activeElement as HTMLElement | null;
            setManualCode("");
            setManualScanOpen(true);
          }}
          className="fixed bottom-4 left-4 z-[90] rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
        >
          Scan card
        </button>
      )}
      {manualScanOpen && (
        <div role="dialog" aria-modal="true" aria-label="Scan card" className="fixed inset-0 z-[1001] flex items-center justify-center bg-zinc-950/80 p-4">
          <form onSubmit={submitManualScan} className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl">
            <h2 className="text-2xl font-black">Scan card</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-600">
              Scan your physical card here. This does not change the Staff form you were editing.
            </p>
            <input
              ref={manualInputRef}
              data-bgm-scan-input="true"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Scan or enter card barcode"
              autoComplete="off"
              className="mt-4 w-full rounded-xl border-2 border-orange-400 px-4 py-3 font-mono text-lg font-bold"
            />
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => { setManualScanOpen(false); setManualCode(""); focusBeforeScan.current?.focus({ preventScroll: true }); }}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 font-bold">Cancel</button>
              <button type="submit" disabled={!manualCode.trim()}
                className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-40">Verify card</button>
            </div>
          </form>
        </div>
      )}
      {(result || networkError || checking) && (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={problem ? "SCAN VERIFICATION ERROR" : result ? heading(result) : "VERIFYING MEMBER"}
      className={`fixed inset-0 z-[1000] flex items-center justify-center overflow-auto p-4 ${color}`}
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
            <h2 className={`mt-3 text-4xl font-black sm:text-6xl ${granted ? "text-emerald-700" : "text-red-700"}`}>
              {heading(result)}
            </h2>
            {result.member ? (
              <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-5 text-left">
                <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 text-5xl font-black text-zinc-300">
                  {result.member.fullName.slice(0, 1)}
                  {result.member.photoUrl && !photoLoadFailed && (
                    <img
                      src={result.member.photoUrl}
                      alt={`${result.member.fullName} photo`}
                      onError={() => setPhotoLoadFailed(true)}
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
            {granted && result.member && (result.member.photoRequired || photoLoadFailed) && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-left text-amber-900">
                <p className="text-center text-lg font-black">PHOTO REQUIRED</p>
                <p className="mt-1 text-center text-sm font-semibold">
                  Entry remains granted. Capture the official member photo now or close this warning.
                </p>
                <div className="mx-auto mt-4 max-w-sm">
                  <OfficialMemberPhotoCapture
                    memberId={result.member.id}
                    source="reception_capture"
                    onSaved={(photoUrl) => {
                      const memberId = result.member?.id;
                      setPhotoLoadFailed(false);
                      setResult(current => current?.member && current.member.id === memberId
                        ? { ...current, member: { ...current.member, photoRequired: false, photoUrl } }
                        : current);
                    }}
                  />
                </div>
              </div>
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
              ? `Close / Verify Next (${queuedCodes.current.length} queued)`
              : "Close / Return to Staff Task"}
          </button>
        )}
      </div>
    </div>
      )}
    </>
  );
}
