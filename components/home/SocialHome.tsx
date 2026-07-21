"use client";

import { Sparkles } from "lucide-react";
import VisualHomeHero from "@/components/home/VisualHomeHero";
import MemberCard from "@/components/member/MemberCard";
import ClosestGymCard from "@/components/home/ClosestGymCard";
import LiveUpdates from "@/components/home/LiveUpdates";
import VisualQuickLinks from "@/components/home/VisualQuickLinks";
import HomeAnnouncementCard from "@/components/home/HomeAnnouncementCard";

export default function SocialHome() {
  return (
    <div className="space-y-6">
      <VisualHomeHero />

      <ClosestGymCard />

      <MemberCard />

      <LiveUpdates />

      <HomeAnnouncementCard />
      <VisualQuickLinks />

      <footer className="rounded-[2rem] border border-white/10 bg-black/25 p-6 text-center">
        <Sparkles className="mx-auto text-[#fcb415]" size={30} strokeWidth={3} />

        <p className="mt-4 text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
          Be the best... Beat the rest
        </p>

        <p className="mt-2 text-sm font-bold text-white/40">
          BestGymsMalta member app
        </p>
      </footer>
    </div>
  );
}
