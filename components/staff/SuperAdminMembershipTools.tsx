"use client";

import { useEffect, useState } from "react";
import StaffMemberBrowser from "@/components/staff/StaffMemberBrowser";
import StaffMembershipQueue from "@/components/staff/StaffMembershipQueue";

export default function SuperAdminMembershipTools() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tool, setTool] = useState<"members" | "waiting">("members");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tool");
    setTool(requested === "waiting" ? "waiting" : "members");
    let active = true;
    void fetch("/api/system/auth", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (active) setAllowed(response.ok && result.authenticated && Boolean(result.user?.isSuperAdmin));
    }).catch(() => { if (active) setAllowed(false); });
    return () => { active = false; };
  }, []);
  if (allowed === null) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Checking Super Admin access…</main>;
  if (!allowed) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Super Admin access required. <a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5">
          <a href="/staff/admin" className="font-bold text-orange-700">← Super Admin</a>
          <h1 className="mt-3 text-3xl font-black">Membership Tools</h1>
          <p className="mt-2 text-sm text-zinc-600">Find a member, open their record and choose Edit Member Details to update personal information.</p>
          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Membership tools">
            <a href="?tool=members" className={tool === "members" ? "rounded-xl bg-orange-600 px-4 py-3 font-bold text-white" : "rounded-xl bg-orange-50 px-4 py-3 font-bold text-orange-700"}>Members</a>
            <a href="/staff/members/enroll?kind=new" className="rounded-xl bg-zinc-100 px-4 py-3 font-bold">New membership</a>
            <a href="/staff/members/enroll?kind=renewal" className="rounded-xl bg-zinc-100 px-4 py-3 font-bold">Renew</a>
            <a href="?tool=waiting" className={tool === "waiting" ? "rounded-xl bg-orange-600 px-4 py-3 font-bold text-white" : "rounded-xl bg-orange-50 px-4 py-3 font-bold text-orange-700"}>Waiting</a>
            <a href="/staff/reception" className="rounded-xl bg-zinc-100 px-4 py-3 font-bold">Reception tools</a>
          </nav>
        </header>
        {tool === "members" ? <StaffMemberBrowser canRenew canEdit/> : <StaffMembershipQueue/>}
      </div>
    </main>
  );
}
