"use client";

import VisualHomeHero from "@/components/home/VisualHomeHero";
import MemberCard from "@/components/member/MemberCard";
import ClosestGymCard from "@/components/home/ClosestGymCard";
import LiveUpdates from "@/components/home/LiveUpdates";
import HomeAnnouncementCard from "@/components/home/HomeAnnouncementCard";
import MemberHomePrimaryTools from "@/components/home/MemberHomePrimaryTools";

export default function SocialHome() {
  return (
    <div data-home-layout="approved-mockup" className="-mx-5 -mt-8 bg-[#f5f5f6] text-zinc-950">
      <VisualHomeHero />

      <div className="relative -mt-3 rounded-t-[2.25rem] bg-[#f5f5f6] px-3 pb-8 pt-3 shadow-[0_-12px_36px_rgba(0,0,0,0.12)]">
        <div className="space-y-3">
          <MemberCard variant="home" />
          <MemberHomePrimaryTools />
          <ClosestGymCard />

          <section id="announcements" className="space-y-3 pt-1">
            <HomeAnnouncementCard />
            <LiveUpdates />
          </section>
        </div>
      </div>
    </div>
  );
}
