"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function StaffPortalReturnButton() {
  const pathname = usePathname();
  // The portal itself is the destination, not a page that needs a return link.
  if (!pathname || pathname === "/staff" || pathname === "/staff/") return null;

  return (
    <nav aria-label="Staff Portal navigation" className="sticky top-0 z-[70] flex w-full justify-start border-b border-white/10 bg-zinc-950 px-4 py-2 shadow-sm print:hidden sm:px-6">
      <Link
        href="/staff"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-400/40 bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:border-orange-400 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Return to Staff Portal
      </Link>
    </nav>
  );
}
