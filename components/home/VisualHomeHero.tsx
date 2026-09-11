"use client";

import { useEffect, useState } from "react";
import { CreditCard, MapPinned } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

export default function VisualHomeHero() {
  const [member, setMember] = useState<AppMember | null>(null);

  useEffect(() => {
    function loadMember() {
      setMember(getSavedMember());
    }

    loadMember();
    window.addEventListener("bgmMemberChanged", loadMember);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadMember);
    };
  }, []);

  const welcomeName = member?.username || member?.fullName?.split(" ")[0] || "Member";

  return (
    <section
      className="relative min-h-[410px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.74) 48%, rgba(0,0,0,.20) 100%), linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.64)), url('/visuals/home-hero.jpg')",
      }}
    >
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute -bottom-24 left-4 h-52 w-52 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative flex min-h-[360px] flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <img
            src="/brand/bgm-logo-white-horizontal.png"
            alt="BestGymsMalta"
            className="h-auto w-[220px] max-w-[68%] object-contain object-left drop-shadow-xl"
          />
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[9px] font-black uppercase tracking-[.2em] text-orange-400 backdrop-blur-md">
            Member
          </span>
        </div>

        <div>
          <p className="text-[11px] font-black uppercase tracking-[.24em] text-orange-400">
            Be the best... Beat the rest
          </p>

          <h1 className="mt-3 max-w-[320px] text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
            Welcome back,
            <span className="block text-orange-500">{welcomeName}</span>
          </h1>

          <p className="mt-4 max-w-[290px] text-sm font-bold leading-6 text-white/70">
            Your membership, gyms, AI training and progress tools in one place.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <a
              href="/card"
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-950/25"
            >
              <CreditCard size={18} strokeWidth={3} />
              Show Card
            </a>

            <a
              href="/gyms"
              className="flex items-center justify-center gap-2 rounded-full border border-orange-500/70 bg-black/45 px-4 py-4 text-sm font-black text-white backdrop-blur-md"
            >
              <MapPinned className="text-orange-400" size={18} strokeWidth={3} />
              Find Gyms
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
