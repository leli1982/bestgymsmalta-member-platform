"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listOfflineMemberships,
  listOfflineMembershipSyncReceipts,
  removeOfflineMembership,
  saveOfflineMembershipSyncReceipt,
  updateOfflineMembershipState,
  type OfflineMembershipRecord,
  type OfflineMembershipSyncReceipt,
} from "@/lib/offlineMembershipQueue";

type SyncResponse = {
  ok?: boolean;
  persisted?: boolean;
  clientSubmissionId?: string;
  result?: "activated" | "review_required" | "rejected";
  applicationId?: string | null;
  memberNumbers?: string[];
  reason?: string;
  error?: string;
};

function reasonLabel(reason?: string) {
  switch (reason) {
    case "active_identity": return "An active member already uses this ID. Reception review is required.";
    case "possible_renewal": return "An existing BGM member was found. Review this as a possible renewal.";
    case "card_conflict": return "The physical card is already registered. A different card must be assigned.";
    case "stale_config": return "The cached price/declaration snapshot needs Super Admin review.";
    case "verification_required": return "One or more required checks still need staff review.";
    default: return "This offline membership needs staff review before activation.";
  }
}

function syncPayload(record: OfflineMembershipRecord) {
  const { photos: _photos, ...payload } = record;
  return payload;
}

export default function OfflineMembershipSyncBridge() {
  const running = useRef(false);
  const dismissedReceiptId = useRef<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<OfflineMembershipSyncReceipt | null>(null);
  const [banner, setBanner] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [records, receipts] = await Promise.all([
        listOfflineMemberships(),
        listOfflineMembershipSyncReceipts(),
      ]);
      setPendingCount(records.length);
      const latestReceipt = receipts[0] || null;
      setLastReceipt(
        latestReceipt && latestReceipt.clientSubmissionId !== dismissedReceiptId.current
          ? latestReceipt
          : null,
      );
    } catch (error) {
      console.error("Could not refresh offline membership sync state.", error);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (running.current || typeof navigator === "undefined" || !navigator.onLine) return;
    running.current = true;
    setLoginRequired(false);
    try {
      const records = await listOfflineMemberships();
      setPendingCount(records.length);
      for (const record of records) {
        await updateOfflineMembershipState(record.clientSubmissionId, "syncing");
        const form = new FormData();
        form.set("payload", JSON.stringify(syncPayload(record)));
        record.photos.forEach((photo, index) => {
          if (photo) form.append(`photo${index}`, photo, `offline-${record.clientSubmissionId}-${index + 1}.webp`);
        });

        let response: Response;
        try {
          response = await fetch("/api/system/members/offline-sync", {
            method: "POST",
            body: form,
            cache: "no-store",
          });
        } catch (networkError) {
          await updateOfflineMembershipState(
            record.clientSubmissionId,
            "error",
            networkError instanceof Error ? networkError.message : "Network unavailable during sync.",
          );
          continue;
        }

        const payload = await response.json().catch(() => ({})) as SyncResponse;
        if (response.status === 401) {
          await updateOfflineMembershipState(record.clientSubmissionId, "needs_login", payload.error || "Staff login required.");
          setLoginRequired(true);
          setBanner("Offline memberships are safe on this device. Sign in again to continue synchronization.");
          break;
        }
        if (!response.ok) {
          await updateOfflineMembershipState(record.clientSubmissionId, "error", payload.error || `Sync failed (${response.status}).`);
          continue;
        }
        if (payload.persisted !== true || !payload.result || payload.clientSubmissionId !== record.clientSubmissionId) {
          await updateOfflineMembershipState(record.clientSubmissionId, "error", "The server response did not confirm a persisted offline receipt.");
          continue;
        }

        const receipt: OfflineMembershipSyncReceipt = {
          clientSubmissionId: record.clientSubmissionId,
          offlineReference: record.offlineReference,
          gymId: record.gymId,
          soldAt: record.soldAt,
          syncedAt: new Date().toISOString(),
          result: payload.result,
          applicationId: typeof payload.applicationId === "string" ? payload.applicationId : null,
          memberNumbers: Array.isArray(payload.memberNumbers) ? payload.memberNumbers.filter((value): value is string => typeof value === "string" && value.length > 0) : [],
          ...(payload.reason ? { reason: payload.reason } : {}),
        };

        await saveOfflineMembershipSyncReceipt(receipt);
        await updateOfflineMembershipState(
          record.clientSubmissionId,
          payload.result === "activated" ? "synced" : "needs_attention",
        );
        await removeOfflineMembership(record.clientSubmissionId);
        dismissedReceiptId.current = null;
        setLastReceipt(receipt);
        setBanner(
          payload.result === "activated"
            ? `Offline membership synchronized${receipt.memberNumbers.length ? ` — ${receipt.memberNumbers.join(", ")}` : ""}.`
            : reasonLabel(payload.reason),
        );
      }
    } finally {
      running.current = false;
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh().then(() => {
      if (navigator.onLine) void runSync();
    });
    const online = () => void runSync();
    const changed = () => {
      void refresh();
      if (navigator.onLine) void runSync();
    };
    window.addEventListener("online", online);
    window.addEventListener("bgm:offline-membership-queue-changed", changed);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("bgm:offline-membership-queue-changed", changed);
    };
  }, [refresh, runSync]);

  if (!pendingCount && !banner && !lastReceipt) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[80] w-[min(92vw,26rem)] rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-950 shadow-2xl" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff5a0a]">Offline membership sync</p>
          <p className="mt-1 text-sm font-bold">
            {pendingCount > 0 ? `${pendingCount} waiting on this terminal` : "Queue synchronized"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissedReceiptId.current = lastReceipt?.clientSubmissionId || null;
            setBanner("");
            setLastReceipt(null);
          }}
          className="text-xs font-bold text-zinc-500"
        >
          Dismiss
        </button>
      </div>

      {banner ? <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm font-semibold text-zinc-700">{banner}</p> : null}

      {lastReceipt?.result === "activated" ? (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-black">Activated</p>
          <p>{lastReceipt.memberNumbers.length ? `BGM: ${lastReceipt.memberNumbers.join(", ")}` : lastReceipt.offlineReference}</p>
        </div>
      ) : null}

      {lastReceipt && lastReceipt.result !== "activated" ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-black">Needs attention</p>
          <p>{reasonLabel(lastReceipt.reason)}</p>
          {lastReceipt.applicationId ? <a href="/staff/applications" className="mt-2 inline-block font-black underline">Open waiting applications</a> : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {pendingCount > 0 && !loginRequired ? (
          <button type="button" onClick={() => void runSync()} className="rounded-xl bg-[#ff5a0a] px-3 py-2 text-xs font-black text-white">Retry sync</button>
        ) : null}
        {loginRequired ? <a href="/staff" className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-black text-white">Staff login</a> : null}
      </div>
    </aside>
  );
}
