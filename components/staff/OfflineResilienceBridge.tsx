"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { registerStaffServiceWorker, syncOfflineRoster } from "@/lib/offlineRosterClient";

const BAR_PENDING_PREFIX = "bgm-bar-pending:";
const BAR_RETRY_MS = 60_000;
const ROSTER_REFRESH_MS = 15 * 60_000;

type StaffAuth = {
  authenticated?: boolean;
  user?: {
    gymId?: string | null;
    isSuperAdmin?: boolean;
  } | null;
};

function pendingBarKeys() {
  if (typeof window === "undefined") return [] as string[];
  try {
    return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(BAR_PENDING_PREFIX)));
  } catch {
    return [] as string[];
  }
}

function pendingKeyContext(key: string) {
  const suffix = key.slice(BAR_PENDING_PREFIX.length);
  const separator = suffix.lastIndexOf(":");
  if (separator <= 0) return null;
  return {
    gymId: suffix.slice(0, separator),
    businessDate: suffix.slice(separator + 1),
  };
}

function maltaBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function OfflineResilienceBridge() {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [pendingBarCount, setPendingBarCount] = useState(0);
  const [barWarning, setBarWarning] = useState("");

  const refreshPendingCount = useCallback(() => {
    setPendingBarCount(pendingBarKeys().length);
  }, []);

  const syncRosterBestEffort = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      await syncOfflineRoster();
    } catch {
      // Login/permission/network failures are expected here. The saved roster stays intact.
    }
  }, []);

  const syncPendingBarBestEffort = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      refreshPendingCount();
      return;
    }

    const keys = pendingBarKeys();
    setPendingBarCount(keys.length);
    if (!keys.length) {
      setBarWarning("");
      return;
    }

    let auth: StaffAuth | null = null;
    try {
      const authResponse = await fetch("/api/system/auth", {
        credentials: "same-origin",
        cache: "no-store",
      });
      auth = authResponse.ok ? (await authResponse.json()) as StaffAuth : null;
    } catch {
      return;
    }
    if (!auth?.authenticated || !auth.user) return;

    const today = maltaBusinessDate();
    let warning = "";

    for (const key of keys) {
      const context = pendingKeyContext(key);
      if (!context) {
        warning = "A pending Bar record could not be read. Keep it for Super Admin review.";
        continue;
      }
      if (context.businessDate !== today) {
        warning = `A Bar update from ${context.businessDate} is still pending. It will not be applied to today's sheet; contact Super Admin.`;
        continue;
      }
      if (!auth.user.isSuperAdmin && auth.user.gymId && context.gymId !== auth.user.gymId) {
        warning = "A pending Bar update belongs to a different gym. It was kept for Super Admin review.";
        continue;
      }

      let payload: unknown;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        payload = JSON.parse(raw);
      } catch {
        warning = "A pending Bar record could not be read. Keep it for Super Admin review.";
        continue;
      }

      try {
        const response = await fetch("/api/system/bar/today", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        let data: { locked?: boolean; error?: string } | null = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (response.ok) {
          window.localStorage.removeItem(key);
          window.dispatchEvent(new CustomEvent("bgm-bar-pending-synced"));
          continue;
        }
        if (response.status === 401 || response.status === 403) break;
        if (data?.locked) {
          warning = "A pending Bar update could not sync because End of Day is already locked. Contact Super Admin; the local copy was kept.";
          continue;
        }
      } catch {
        // Keep the local payload. Another reconnect/interval retry will try again.
      }
    }

    setBarWarning(warning);
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const refreshNetworkState = () => setOnline(navigator.onLine);
    const syncNow = () => {
      refreshNetworkState();
      if (!navigator.onLine) {
        refreshPendingCount();
        return;
      }
      void syncRosterBestEffort();
      void syncPendingBarBestEffort();
    };

    void registerStaffServiceWorker();
    refreshNetworkState();
    refreshPendingCount();
    syncNow();

    window.addEventListener("online", syncNow);
    window.addEventListener("offline", refreshNetworkState);
    window.addEventListener("bgm-staff-auth-changed", syncNow);
    window.addEventListener("storage", refreshPendingCount);
    window.addEventListener("bgm-bar-pending-synced", refreshPendingCount);

    const barTimer = window.setInterval(() => void syncPendingBarBestEffort(), BAR_RETRY_MS);
    const rosterTimer = window.setInterval(() => void syncRosterBestEffort(), ROSTER_REFRESH_MS);

    return () => {
      window.removeEventListener("online", syncNow);
      window.removeEventListener("offline", refreshNetworkState);
      window.removeEventListener("bgm-staff-auth-changed", syncNow);
      window.removeEventListener("storage", refreshPendingCount);
      window.removeEventListener("bgm-bar-pending-synced", refreshPendingCount);
      window.clearInterval(barTimer);
      window.clearInterval(rosterTimer);
    };
  }, [refreshPendingCount, syncPendingBarBestEffort, syncRosterBestEffort]);

  const hideLookup = pathname === "/staff/offline" || pathname.startsWith("/staff/admin");

  return (
    <>
      {barWarning && !pathname.startsWith("/staff/admin") && (
        <div className="fixed bottom-36 left-4 z-[72] max-w-sm rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-lg print:hidden">
          {barWarning}
        </div>
      )}
      {!hideLookup && !online && (
        <a
          href="/staff/offline"
          className="fixed bottom-20 left-4 z-[72] inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-xs font-black text-white shadow-lg print:hidden"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
          OFFLINE · Member Lookup
          {pendingBarCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">{pendingBarCount} Bar pending</span>}
        </a>
      )}
    </>
  );
}
