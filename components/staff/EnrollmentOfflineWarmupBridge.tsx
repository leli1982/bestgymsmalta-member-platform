"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cacheOfflineEnrollmentContext, type OfflineEnrollmentContext } from "@/lib/offlineMembershipQueue";
import type { PublicEnrollmentConfig } from "@/lib/membershipRegistrationTypes";

const REFRESH_MS = 15 * 60_000;

type RegistrationPayload = {
  config?: PublicEnrollmentConfig | null;
  systemUser?: {
    id?: unknown;
    gymId?: unknown;
    displayName?: unknown;
    isSuperAdmin?: unknown;
  } | null;
};

export default function EnrollmentOfflineWarmupBridge() {
  const router = useRouter();

  const warmEnrollmentContext = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    try {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
      router.prefetch("/staff/members/enroll?kind=new");

      const response = await fetch("/api/system/members/registration", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;

      const payload = (await response.json().catch(() => ({}))) as RegistrationPayload;
      if (!payload.config || !payload.systemUser) return;
      if (payload.systemUser.isSuperAdmin === true) return;

      const context: OfflineEnrollmentContext = {
        gymId: payload.config.gym.id,
        cachedAt: new Date().toISOString(),
        config: payload.config,
        systemUser: {
          id: String(payload.systemUser.id || ""),
          gymId: typeof payload.systemUser.gymId === "string" ? payload.systemUser.gymId : null,
          displayName: String(payload.systemUser.displayName || ""),
          isSuperAdmin: false,
        },
      };

      if (!context.systemUser.id || !context.systemUser.gymId || !context.systemUser.displayName) return;
      await cacheOfflineEnrollmentContext(context);
    } catch {
      // Best effort only. Keep the most recent valid cached enrollment context intact.
    }
  }, [router]);

  useEffect(() => {
    const warmNow = () => void warmEnrollmentContext();
    warmNow();
    window.addEventListener("online", warmNow);
    window.addEventListener("bgm-staff-auth-changed", warmNow);
    const timer = window.setInterval(warmNow, REFRESH_MS);
    return () => {
      window.removeEventListener("online", warmNow);
      window.removeEventListener("bgm-staff-auth-changed", warmNow);
      window.clearInterval(timer);
    };
  }, [warmEnrollmentContext]);

  return null;
}
