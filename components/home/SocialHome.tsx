"use client";

import { Sparkles } from "lucide-react";
import VisualHomeHero from "@/components/home/VisualHomeHero";
import MemberCard from "@/components/member/MemberCard";
import ClosestGymCard from "@/components/home/ClosestGymCard";
import LiveUpdates from "@/components/home/LiveUpdates";
import HomeAnnouncementCard from "@/components/home/HomeAnnouncementCard";
import MemberHomePrimaryTools from "@/components/home/MemberHomePrimaryTools";

export default function SocialHome() {
  return (
    <div className="-mx-5 -mt-8">
      <div className="px-5 pt-8">
        <VisualHomeHero />
      </div>

      <div className="mt-5 rounded-t-[2.5rem] bg-zinc-50 px-5 pb-10 pt-5 text-zinc-950 shadow-[0_-16px_50px_rgba(0,0,0,0.18)]">
        <div className="space-y-4">
          <MemberCard />

          <MemberHomePrimaryTools />

          <ClosestGymCard />

          <HomeAnnouncementCard />

          <LiveUpdates />

          <footer className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <Sparkles className="mx-auto text-orange-500" size={28} strokeWidth={3} />
            <p className="mt-4 text-xs font-black uppercase tracking-[.22em] text-orange-600">
              Be the best... Beat the rest
            </p>
            <p className="mt-2 text-sm font-bold text-zinc-400">BestGymsMalta member app</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
