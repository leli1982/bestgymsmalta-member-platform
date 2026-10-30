"use client";

import { useCallback, useEffect } from "react";
import { cacheOfflineEnrollmentContext, type OfflineEnrollmentContext } from "@/lib/offlineMembershipQueue";
import type { PublicEnrollmentConfig } from "@/lib/membershipRegistrationTypes";

const REFRESH_MS = 15 * 60_000;
const NEW_MEMBER_ROUTE = "/staff/members/enroll?kind=new";

type RegistrationPayload = {
  config?: PublicEnrollmentConfig | null;
  systemUser?: {
    id?: unknown;
    gymId?: unknown;
    displayName?: unknown;
    isSuperAdmin?: unknown;
  } | null;
};

async function warmNewMemberRouteAssets() {
  if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;

  const pageResponse = await fetch("/staff/members/enroll?kind=new", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!pageResponse.ok) return;

  const html = await pageResponse.text();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const assetUrls = Array.from(parsed.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]"))
    .map((element) => element instanceof HTMLScriptElement ? element.src : element.href)
    .filter(Boolean)
    .map((asset) => new URL(asset, window.location.origin))
    .filter((asset) => asset.origin === window.location.origin && asset.pathname.startsWith("/_next/static/"))
    .map((asset) => asset.href);

  await Promise.allSettled(
    Array.from(new Set(assetUrls)).map((assetUrl) =>
      fetch(assetUrl, {
        credentials: "same-origin",
        cache: "reload",
      }),
    ),
  );
}

export default function EnrollmentOfflineWarmupBridge() {
  const warmEnrollmentContext = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    try {
      await warmNewMemberRouteAssets();

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
  }, []);

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
