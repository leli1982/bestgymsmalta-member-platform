"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Beer, Bell, Building2, ClipboardList, Dumbbell,
  FileBarChart2, KeyRound, Megaphone, RefreshCw, Settings2, ShieldCheck, UserPlus, UsersRound, Barcode, ShoppingBasket,
} from "lucide-react";

type AdminUser = { displayName: string; isSuperAdmin: boolean };
type Section = {
  href: string;
  label: string;
  description: string;
  icon: typeof Beer;
  group: "Operations" | "Management" | "Membership Tools";
};
const sections: Section[] = [
  {
    href: "/staff/operations", label: "Operations dashboard",
    description: "Review Sundries and Bar submissions across all gyms.",
    icon: ClipboardList, group: "Operations",
  },
  {
    href: "/staff/admin/shopping-list", label: "Shopping List",
    description: "Combined Sundries quantities to buy, grouped gym deliveries, and individual Delivered controls.",
    icon: ShoppingBasket, group: "Operations",
  },
  {
    href: "/staff/bar/reports", label: "Bar reports",
    description: "Review submitted Bar Lists, cash comparisons and totals by gym and date.",
    icon: FileBarChart2, group: "Operations",
  },
  {
    href: "/staff/admin/announcements", label: "Announcements",
    description: "Publish member news, images and links; schedule, edit or hide announcements.",
    icon: Megaphone, group: "Management",
  },
  {
    href: "/staff/admin/gyms", label: "Gym locations",
    description: "Add and edit gyms, opening hours, active status, staff access and tablet registration links.",
    icon: Building2, group: "Management",
  },
  {
    href: "/staff/admin/super-admins", label: "Super Admin accounts",
    description: "View, add, edit usernames, reset passwords and manage Super Admin access.",
    icon: ShieldCheck, group: "Management",
  },
  {
    href: "/staff/admin/staff-logins", label: "Staff Portal logins",
    description: "Manage each gym's staff username, password and active status.",
    icon: KeyRound, group: "Management",
  },
  {
    href: "/staff/bar/catalog", label: "Bar catalogue & prices",
    description: "Edit the official Bar List products, selling prices and availability.",
    icon: Beer, group: "Management",
  },
  {
    href: "/staff/admin/membership-tools?tool=members", label: "Members",
    description: "Find and inspect membership records.", icon: UsersRound, group: "Membership Tools",
  },
  {
    href: "/staff/admin/member-data", label: "Member import & export",
    description: "Upload the original 15-column legacy Excel file safely; preview matches, preserve existing members, and export the numbered BGM list.",
    icon: FileBarChart2, group: "Membership Tools",
  },
  {
    href: "/staff/members/enroll?kind=new", label: "New membership",
    description: "Create a new membership.", icon: UserPlus, group: "Membership Tools",
  },
  {
    href: "/staff/members/enroll?kind=renewal", label: "Renew",
    description: "Renew an existing membership.", icon: RefreshCw, group: "Membership Tools",
  },
  {
    href: "/staff/admin/membership-tools?tool=waiting", label: "Waiting",
    description: "View and review pending membership applications.", icon: Bell, group: "Membership Tools",
  },
  {
    href: "/staff/reception", label: "Reception tools",
    description: "Card scanning and reception actions.", icon: Barcode, group: "Membership Tools",
  },
  {
    href: "/staff/membership-settings", label: "Membership settings",
    description: "Manage membership prices, declarations and other settings.",
    icon: Settings2, group: "Membership Tools",
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
  if (checking) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-700">Checking Super Admin access…</main>;
  if (error) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900"><p role="alert">{error}</p><a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  if (!user?.isSuperAdmin) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900"><p>Super Admin access required.</p><a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4"/> Staff Home</a>
          <div className="mt-5 flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white"><Dumbbell className="h-9 w-9"/></span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-700">BestGymsMalta management</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Super Admin</h1>
              <p className="mt-1 text-sm text-zinc-600">Welcome, {user.displayName}. Choose a management area below.</p>
            </div>
          </div>
        </header>
        {(["Operations", "Management", "Membership Tools"] as const).map((group) => (
          <section key={group} aria-label={group} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <h2 className="text-xl font-black">{group}</h2>
              <p className="text-xs font-semibold text-zinc-500">
                {group === "Operations" ? "Daily sales and orders" : group === "Management" ? "Gym locations and account access" : "Occasional member and reception actions"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {sections.filter((section) => section.group === group).map(({ href, label, description, icon: Icon }) => (
                <a key={href} href={href} className="group flex min-h-32 items-start gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><Icon className="h-6 w-6"/></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2 text-lg font-black">{label}<ArrowUpRight className="h-5 w-5 shrink-0 text-orange-700"/></span>
                    <span className="mt-2 block text-sm leading-6 text-zinc-600">{description}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
        <p className="px-1 text-xs text-zinc-500">The Staff Portal layout is unchanged. Punch Clock will be added in a later phase.</p>
      </div>
    </main>
  );
}
