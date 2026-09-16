"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Barcode,
  Beer,
  Boxes,
  Clock3,
  Dumbbell,
  LogOut,
  PackagePlus,
  RefreshCw,
  Settings2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import StaffMemberBrowser from "@/components/staff/StaffMemberBrowser";
import StaffMembershipQueue from "@/components/staff/StaffMembershipQueue";
import StaffRealtimeBridge from "@/components/staff/StaffRealtimeBridge";

type SystemUser = {
  id: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

type Props = {
  user: SystemUser;
  onLogout: () => void | Promise<void>;
};

type RealtimeStatus = "connecting" | "connected" | "disconnected" | "disabled";

function MaltaClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <span suppressHydrationWarning>
      {new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Malta",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(now)}
    </span>
  );
}

function Tile({
  label,
  icon: Icon,
  href,
  onClick,
  badge,
  disabled = false,
}: {
  label: string;
  icon: typeof UsersRound;
  href?: string;
  onClick?: () => void;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white">
        <Icon className="h-7 w-7" strokeWidth={2.2} />
        {badge && (
          <span className="absolute -right-3 -top-3 rounded-full bg-[#ff5a0a] px-2 py-1 text-[10px] font-black text-white shadow-sm">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-3 text-center text-sm font-black leading-tight text-zinc-950">{label}</span>
    </>
  );
  const cls = `group flex min-h-32 flex-col items-center justify-center rounded-3xl border bg-white p-4 shadow-sm transition ${disabled ? "cursor-not-allowed border-zinc-200 opacity-45" : "border-zinc-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"}`;

  if (disabled) return <div className={cls}>{content}</div>;
  if (href) return <a href={href} aria-label={label} className={cls}>{content}</a>;
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{content}</button>;
}

export default function StaffDashboard({ user, onLogout }: Props) {
  const [queueCount, setQueueCount] = useState(0);
  const [queueRefreshToken, setQueueRefreshToken] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(user.gymId ? "connecting" : "disabled");
  const [memberFocusToken, setMemberFocusToken] = useState(0);
  const [membershipActionOpen, setMembershipActionOpen] = useState(false);

  const can = useCallback(
    (permission: string) => user.isSuperAdmin || user.permissions.includes(permission),
    [user.isSuperAdmin, user.permissions]
  );

  const signalQueueRefresh = useCallback(() => {
    setQueueRefreshToken((value) => value + 1);
  }, []);

  const realtimeLabel = useMemo(() => {
    if (!user.gymId) return "Network view";
    if (realtimeStatus === "connected") return "Realtime connected";
    if (realtimeStatus === "connecting") return "Realtime connecting";
    if (realtimeStatus === "disabled") return "Realtime disabled";
    return "Realtime disconnected";
  }, [realtimeStatus, user.gymId]);

  function focusMembers() {
    setMemberFocusToken((value) => value + 1);
    document.getElementById("staff-members")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusWaiting() {
    document.getElementById("staff-waiting")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const canCreateMembership = can("members.create");
  const canRenewMembership = can("members.renew") && can("members.view");

  return (
    <main className="min-h-screen bg-[#f6f6f6] text-zinc-950">
      {user.gymId && (
        <StaffRealtimeBridge
          onQueueChanged={signalQueueRefresh}
          onConnectionChange={(connected) => setRealtimeStatus(connected ? "connected" : "disconnected")}
        />
      )}
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white">
                <Dumbbell className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a0a]">BestGymsMalta Staff</p>
                <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{user.displayName}</h1>
                <p className="mt-0.5 text-xs font-semibold text-zinc-400"><MaltaClock /></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {queueCount > 0 && (
                <button type="button" onClick={focusWaiting} className="rounded-full bg-[#ff5a0a] px-3 py-2 text-xs font-black text-white">
                  {queueCount} WAITING
                </button>
              )}
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${realtimeStatus === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                <span className={`h-2 w-2 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                {realtimeLabel}
              </span>
              <button type="button" onClick={() => void onLogout()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50">
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Members" icon={UsersRound} onClick={focusMembers} />
          <Tile label="New Member" icon={PackagePlus} onClick={() => setMembershipActionOpen(true)} badge={queueCount > 0 ? String(queueCount) : undefined} />
          <Tile label="Card / Reception" icon={Barcode} href="/staff/reception" disabled={!can("barcode.scan")} />
          <Tile label="Sundries" icon={Boxes} href="/staff/sundries" disabled={!can("orders.sundries.submit")} />
          <Tile label="Bar" icon={Beer} href="/staff/bar" disabled={!can("orders.bar.submit")} />
          {user.isSuperAdmin && (
            <Tile label="Membership Settings" icon={Settings2} href="/staff/membership-settings" />
          )}
          <Tile label="Punch Clock" icon={Clock3} disabled />
        </section>

        <div className="mt-5">
          <StaffMembershipQueue refreshToken={queueRefreshToken} onCountChange={setQueueCount} />
        </div>

        <div className="mt-5">
          <StaffMemberBrowser focusToken={memberFocusToken} canRenew={canRenewMembership} />
        </div>
      </div>

      {membershipActionOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="membership-action-title">
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a0a]">Membership action</p>
                <h2 id="membership-action-title" className="mt-1 text-2xl font-black text-zinc-950">What do you need to do?</h2>
                <p className="mt-1 text-sm text-zinc-500">Start a new membership or renew an existing BGM member.</p>
              </div>
              <button type="button" onClick={() => setMembershipActionOpen(false)} aria-label="Close membership action" className="rounded-xl border border-zinc-200 p-2.5 text-zinc-500 hover:bg-zinc-50"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <a
                href="/staff/members/enroll?kind=new"
                aria-disabled={!canCreateMembership}
                onClick={(event) => { if (!canCreateMembership) event.preventDefault(); }}
                className={`flex min-h-44 flex-col justify-between rounded-3xl border-2 p-6 transition ${canCreateMembership ? "border-zinc-950 bg-zinc-950 text-white hover:-translate-y-0.5" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"}`}
              >
                <UserPlus className="h-9 w-9" />
                <span>
                  <span className="block text-2xl font-black">NEW MEMBER</span>
                  <span className={`mt-2 block text-sm ${canCreateMembership ? "text-zinc-300" : "text-zinc-400"}`}>Create a genuinely new BGM membership.</span>
                </span>
              </a>

              <a
                href="/staff/members/enroll?kind=renewal"
                aria-disabled={!canRenewMembership}
                onClick={(event) => { if (!canRenewMembership) event.preventDefault(); }}
                className={`flex min-h-44 flex-col justify-between rounded-3xl border-2 p-6 transition ${canRenewMembership ? "border-orange-400 bg-orange-50 text-orange-950 hover:-translate-y-0.5" : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"}`}
              >
                <RefreshCw className="h-9 w-9" />
                <span>
                  <span className="block text-2xl font-black">RENEW</span>
                  <span className={`mt-2 block text-sm ${canRenewMembership ? "text-orange-900/70" : "text-zinc-400"}`}>Find the existing member, keep their data, and confirm the old or a new card.</span>
                </span>
              </a>
            </div>

            {queueCount > 0 && (
              <button type="button" onClick={() => { setMembershipActionOpen(false); window.setTimeout(focusWaiting, 0); }} className="mt-4 w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-black text-orange-800">
                {queueCount} submitted application{queueCount === 1 ? "" : "s"} waiting — open queue
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
