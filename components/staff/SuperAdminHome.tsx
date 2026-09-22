"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Beer, ClipboardList, Dumbbell, FileBarChart2,
  Settings2, ArrowUpRight, ShieldCheck,
} from "lucide-react";

type AdminUser = { displayName: string; isSuperAdmin: boolean };
type Section = {
  href: string;
  label: string;
  description: string;
  icon: typeof Beer;
  group: "Operations" | "Configuration";
};

const sections: Section[] = [
  {
    href: "/staff/operations",
    label: "Operations dashboard",
    description: "Review Sundries and Bar submissions from every gym, follow up on failed notifications, and progress Sundries orders.",
    icon: ClipboardList,
    group: "Operations",
  },
  {
    href: "/staff/bar/reports",
    label: "Bar reports",
    description: "Review lists, original selling prices and totals by Malta business date and gym.",
    icon: FileBarChart2,
    group: "Operations",
  },
  {
    href: "/staff/bar/catalog",
    label: "Bar catalogue & prices",
    description: "Publish products and prices, manage display order, hide products and configure Others for Staff.",
    icon: Beer,
    group: "Configuration",
  },
  {
    href: "/staff/membership-settings",
    label: "Membership settings",
    description: "Manage the membership configurations already available to Super Admin.",
    icon: Settings2,
    group: "Configuration",
  },
];

export default function SuperAdminHome() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not verify your session.");
        const data = await response.json();
        if (active) setUser(data.authenticated ? data.user : null);
      } catch {
        if (active) setError("Could not verify Super Admin access. Try refreshing.");
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (checking) return <main className="min-h-screen bg-[#f6f6f6] p-8 text-zinc-700">Checking Super Admin access…</main>;
  if (error) return (
    <main className="min-h-screen bg-[#f6f6f6] p-8">
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
      <a className="mt-4 inline-block text-sm font-bold text-orange-700 underline" href="/staff">Staff Home</a>
    </main>
  );
  if (!user?.isSuperAdmin) return (
    <main className="min-h-screen bg-[#f6f6f6] p-8 text-zinc-900">
      <p>Super Admin access required.</p>
      <a href="/staff" className="mt-4 inline-block font-bold text-orange-700 underline">Staff Home</a>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff" className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
            <ArrowLeft className="h-4 w-4" /> Staff Home
          </a>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white">
              <Dumbbell className="h-9 w-9" />
            </span>
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-700">
                <ShieldCheck className="h-4 w-4" /> BestGymsMalta management
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Super Admin</h1>
              <p className="mt-1 text-sm text-zinc-600">Welcome, {user.displayName}. Choose a management area below.</p>
            </div>
          </div>
        </header>

        {(["Operations", "Configuration"] as const).map((group) => (
          <section key={group} aria-label={group} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <h2 className="text-xl font-black">{group}</h2>
              <p className="text-xs font-semibold text-zinc-500">
                {group === "Operations" ? "All gym locations" : "System-wide management"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sections.filter((section) => section.group === group).map(({ href, label, description, icon: Icon }) => (
                <a key={href} href={href} className="group flex min-h-40 items-start gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2 text-lg font-black">
                      {label} <ArrowUpRight className="h-5 w-5 shrink-0 text-orange-700" />
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-zinc-600">{description}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <p className="px-1 text-xs text-zinc-500">
          Staff enrollment and member check-in remain accessible from Staff Home. Punch Clock is reserved for a later phase.
        </p>
      </div>
    </main>
  );
}
