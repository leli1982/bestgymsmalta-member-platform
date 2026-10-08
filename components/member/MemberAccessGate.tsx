"use client";

import { formatEuropeanDate } from "@/lib/europeanDate";
import { clearSavedMember } from "@/lib/memberSession";
import { AlertTriangle, CalendarClock, LockKeyhole } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

type Access = {
  state: "active" | "grace" | "locked";
  daysUntilExpiry: number;
  graceDaysRemaining: number;
  reminderDue: boolean;
};

type SessionPayload = {
  member?: { membershipExpiry?: string | null };
  access?: Access;
  error?: string;
};

const PUBLIC_PREFIXES = [
  "/member-login",
  "/member-activate",
  "/member-reset-password",
  "/join",
  "/staff",
  "/bgm-admin",
  "/design-system",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function MemberAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPath = isPublicPath(pathname || "/");
  const [payload, setPayload] = useState<SessionPayload | null>(publicPath ? {} : null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (publicPath) {
      setPayload({});
      setNoticeOpen(false);
      return;
    }

    let active = true;
    fetch("/api/member/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as SessionPayload;
        if (!response.ok) {
          if (response.status === 401) {
            // Keep the existing signed-out card surface available. It contains no
            // member data and its own protected card API still requires a session.
            // This also preserves the established sign-in -> return-to-card flow.
            if (pathname === "/card") return {};
            router.replace(`/member-login?next=${encodeURIComponent(pathname || "/")}`);
            return null;
          }
          throw new Error(json.error || "Could not verify membership access.");
        }
        return json;
      })
      .then((json) => {
        if (!active || !json) return;
        setPayload(json);
        if (json.access?.state === "grace" || (json.access?.state === "active" && json.access.reminderDue)) {
          const expiry = json.member?.membershipExpiry || "unknown";
          const key = `bgm-member-access-notice:${json.access.state}:${expiry}`;
          let alreadyShown = false;
          try {
            alreadyShown = window.sessionStorage.getItem(key) === "shown";
          } catch {
            alreadyShown = false;
          }
          setNoticeOpen(!alreadyShown);
        }
      })
      .catch((error) => {
        if (!active) return;
        setPayload({ error: error instanceof Error ? error.message : "Could not verify membership access." });
      });

    return () => {
      active = false;
    };
  }, [pathname, publicPath, router]);

  const access = payload?.access;
  const expiry = payload?.member?.membershipExpiry || null;
  const noticeKey = useMemo(
    () => access && expiry ? `bgm-member-access-notice:${access.state}:${expiry}` : "",
    [access, expiry],
  );

  function dismissNotice() {
    if (noticeKey) {
      try {
        window.sessionStorage.setItem(noticeKey, "shown");
      } catch {
        // The notice still closes for this mounted app when storage is unavailable.
      }
    }
    setNoticeOpen(false);
  }

  async function signOut() {
    await clearSavedMember();
    router.replace("/member-login");
  }

  if (publicPath) return <>{children}</>;

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6] px-6 text-center text-sm font-bold text-zinc-500">
        Checking membership access…
      </div>
    );
  }

  if (payload.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6] px-6">
        <div className="max-w-sm rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-3 text-xl font-black text-zinc-950">Could not verify membership</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-600">{payload.error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">Try again</button>
        </div>
      </div>
    );
  }

  if (access?.state === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6] px-5 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-orange-200 bg-white p-7 text-center shadow-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <LockKeyhole className="h-7 w-7" />
          </span>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-orange-700">Membership renewal required</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Your member app is locked</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
            Your membership is no longer active. Renew at a BestGymsMalta reception to restore full app access.
          </p>
          {expiry ? <p className="mt-3 text-sm font-black text-zinc-900">Membership expiry: {formatEuropeanDate(expiry)}</p> : null}
          <p className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm font-semibold leading-6 text-zinc-700">
            Your account, workout history, passport, goals and saved information are preserved.
          </p>
          <button type="button" onClick={() => void signOut()} className="mt-6 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-900">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {noticeOpen && access ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 text-zinc-950 shadow-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <CalendarClock className="h-6 w-6" />
            </span>
            {access.state === "grace" ? (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-orange-700">Renewal grace period</p>
                <h2 className="mt-2 text-2xl font-black">Your membership has expired</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
                  You have <strong>{access.graceDaysRemaining} {access.graceDaysRemaining === 1 ? "day" : "days"}</strong> of member-app access remaining. Please renew at reception before the grace period ends.
                </p>
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                  App grace does not extend gym-entry access. An expired membership will still be declined at check-in.
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-orange-700">Membership reminder</p>
                <h2 className="mt-2 text-2xl font-black">Your membership expires soon</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
                  Your membership expires {access.daysUntilExpiry === 1 ? "tomorrow" : `in ${access.daysUntilExpiry} days`}{expiry ? `, on ${formatEuropeanDate(expiry)}` : ""}. Renew before expiry to keep uninterrupted gym access.
                </p>
              </>
            )}
            <button type="button" onClick={dismissNotice} className="mt-6 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">Continue</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
