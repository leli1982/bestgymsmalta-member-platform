"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
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

  const welcomeName =
    member?.username || member?.fullName?.split(" ")[0] || "Member";

  return (
    <section
      className="relative min-h-[410px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.72)), linear-gradient(135deg, rgba(252,180,21,.26), rgba(0,0,0,.86)), url('/visuals/home-hero.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/85" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />
      <div className="absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-[#fcb415]/10 blur-3xl" />

      <div className="relative flex min-h-[360px] flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              BestGymsMalta
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/35 backdrop-blur-md">
            <Sparkles className="text-[#fcb415]" size={22} strokeWidth={3} />
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[.24em] text-[#fcb415]">
            Be the best... Beat the rest
          </p>

          <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
            Welcome back, {welcomeName}
          </h1>

          <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
            Your membership, gyms, trainer, stories and progress tools in one
            place.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <a
              href="/gyms"
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              Find Gyms
              <ChevronRight size={17} strokeWidth={3} />
            </a>

            <a
              href="/story"
              className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-black text-white backdrop-blur-md"
            >
              Create Story
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
