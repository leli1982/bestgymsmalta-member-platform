"use client";

import { ChevronRight, Menu } from "lucide-react";

export default function MoreShortcut() {
  return (
    <a
      href="/more"
      className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415]/10 text-[#fcb415]">
          <Menu size={26} strokeWidth={3} />
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            More
          </p>
          <h2 className="mt-1 text-xl font-black text-white">
            Passport, contact & logout
          </h2>
        </div>
      </div>

      <ChevronRight className="shrink-0 text-white/35" size={20} strokeWidth={3} />
    </a>
  );
}
