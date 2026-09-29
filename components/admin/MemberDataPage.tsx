"use client";
import { useEffect, useState } from "react";
import MembershipDataAdmin from "@/components/admin/MembershipDataAdmin";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
export default function MemberDataPage() {
  const [allowed,setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let active=true;
    fetch("/api/system/auth",{cache:"no-store"}).then(r=>r.json()).then(x => {
      if(active) setAllowed(Boolean(x.authenticated && x.user?.isSuperAdmin));
    }).catch(() => { if(active) setAllowed(false); });
    return () => { active=false; };
  },[]);
  if(allowed===null) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Checking Super Admin access…</main>;
  if(!allowed) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Super Admin access required. <a href="/staff" className="underline">Staff Home</a></main>;
  return <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft size={17}/> Super Admin</a>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-2xl bg-orange-50 p-3 text-orange-700"><FileSpreadsheet size={30}/></span>
          <div><p className="text-xs font-black uppercase tracking-widest text-orange-700">Members · Data exchange</p>
          <h1 className="text-3xl font-black">Member import &amp; export</h1>
          <p className="mt-1 text-sm text-zinc-600">Upload your existing AllCustomers Excel without changing its columns. Preview first; never delete or overwrite an existing member.</p></div>
        </div>
      </header>
      <section className="rounded-3xl bg-zinc-950 p-4 text-white shadow-lg sm:p-6">
        <MembershipDataAdmin/>
      </section>
    </div>
  </main>;
}
