"use client";

import { useCallback, useEffect } from "react";

const REFRESH_MS = 15 * 60_000;

type AuthPayload = {
  authenticated?: boolean;
  user?: {
    gymId?: string | null;
    isSuperAdmin?: boolean;
    role?: string;
  } | null;
};

export default function BarOfflineWarmupBridge() {
  const warmBarCache = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    try {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
      const authResponse = await fetch("/api/system/auth", { credentials: "same-origin", cache: "no-store" });
      const auth = authResponse.ok ? (await authResponse.json()) as AuthPayload : null;
      const user = auth?.authenticated ? auth.user : null;
      if (!user?.gymId || user.isSuperAdmin || user.role === "super_admin") return;

      await Promise.all([
        fetch("/api/gyms", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/system/bar/catalog", { credentials: "same-origin", cache: "no-store" }),
        fetch(`/api/system/bar/today?gymId=${encodeURIComponent(user.gymId)}`, { credentials: "same-origin", cache: "no-store" }),
      ]);
    } catch {
      // Best effort only. Existing cached Bar data must stay intact on any failure.
    }
  }, []);

  useEffect(() => {
    const warmNow = () => void warmBarCache();
    warmNow();
    window.addEventListener("online", warmNow);
    window.addEventListener("bgm-staff-auth-changed", warmNow);
    navigator.serviceWorker?.addEventListener("controllerchange", warmNow);
    const timer = window.setInterval(warmNow, REFRESH_MS);
    return () => {
      window.removeEventListener("online", warmNow);
      window.removeEventListener("bgm-staff-auth-changed", warmNow);
      navigator.serviceWorker?.removeEventListener("controllerchange", warmNow);
      window.clearInterval(timer);
    };
  }, [warmBarCache]);

  return null;
}
