"use client";

import { usePathname } from "next/navigation";

export default function EmergencySupportFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/staff/admin")) return null;

  return (
    <footer className="px-4 pb-5 pt-2 text-center text-xs font-semibold text-zinc-500 print:hidden">
      For Emergency issues contact Andre on 7909 0998
    </footer>
  );
}
