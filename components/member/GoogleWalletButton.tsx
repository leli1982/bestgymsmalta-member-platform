"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WALLET_ENDPOINT = "/api/member/google-wallet";

type WalletReason =
  | "archived"
  | "inactive"
  | "cancelled"
  | "expired"
  | "card_missing"
  | "membership_missing"
  | "unavailable"
  | null;

type WalletStatus = {
  available: boolean;
  eligible: boolean;
  reason: WalletReason;
  provisioned?: boolean;
  syncStatus?: string | null;
  lastSyncedAt?: string | null;
};

const INELIGIBLE_COPY: Record<Exclude<WalletReason, null | "unavailable">, string> = {
  archived: "This membership is archived and cannot be added to Google Wallet.",
  inactive: "Activate your membership before adding it to Google Wallet.",
  cancelled: "This membership is cancelled and cannot be added to Google Wallet.",
  expired: "Renew your membership before adding it to Google Wallet.",
  card_missing: "Ask staff to assign an active card before adding it to Google Wallet.",
  membership_missing: "Your membership details are not ready for Google Wallet yet.",
};

function fallbackStatus(): WalletStatus {
  return {
    available: false,
    eligible: false,
    reason: "unavailable",
    provisioned: false,
    syncStatus: null,
    lastSyncedAt: null,
  };
}

export default function GoogleWalletButton() {
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(WALLET_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setStatus(fallbackStatus());
        return;
      }
      const data = await response.json().catch(() => null) as WalletStatus | null;
      if (!data || typeof data.available !== "boolean" || typeof data.eligible !== "boolean") {
        setStatus(fallbackStatus());
        return;
      }
      setStatus(data);
    } catch {
      setStatus(fallbackStatus());
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const addToWallet = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(WALLET_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => null) as {
        saveUrl?: string;
        error?: string;
        reason?: WalletReason;
      } | null;

      if (!response.ok || !data?.saveUrl) {
        if (response.status === 409 && data?.reason) {
          await loadStatus();
        }
        setError("Google Wallet is temporarily unavailable. Please try again.");
        return;
      }

      window.location.assign(data.saveUrl);
    } catch {
      setError("Google Wallet is temporarily unavailable. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [loadStatus]);

  if (!status) {
    return (
      <div className="mt-4 flex min-h-[66px] items-center justify-center" aria-live="polite">
        <span className="text-xs font-semibold text-slate-500">Checking Google Wallet…</span>
      </div>
    );
  }

  if (!status.available) return null;

  if (!status.eligible) {
    const reason = status.reason && status.reason !== "unavailable"
      ? INELIGIBLE_COPY[status.reason]
      : "This membership is not currently eligible for Google Wallet.";
    return (
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center" aria-live="polite">
        <p className="text-xs font-semibold leading-5 text-slate-600">{reason}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 px-2" aria-live="polite">
      <button
        type="button"
        onClick={() => void addToWallet()}
        disabled={submitting}
        aria-label="Add to Google Wallet"
        aria-busy={submitting}
        className="min-h-12 max-w-full rounded-full disabled:cursor-wait disabled:opacity-60"
      >
        <img
          src="/google-wallet/add-to-google-wallet.svg"
          alt=""
          aria-hidden="true"
          className="h-[50px] w-[283px] max-w-full"
        />
      </button>
      {submitting && <p className="text-xs font-semibold text-slate-500">Preparing your pass…</p>}
      {error && <p className="text-center text-xs font-semibold text-amber-700">{error}</p>}
    </div>
  );
}
