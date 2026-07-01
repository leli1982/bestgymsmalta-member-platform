import AppShell from "@/components/ui/AppShell";
import GlassPanel from "@/components/ui/GlassPanel";
import MemberCard from "@/components/member/MemberCard";
import GreetingHero from "@/components/member/GreetingHero";
import TodaysFocus from "@/components/member/TodaysFocus";
import FitnessSnapshot from "@/components/member/FitnessSnapshot";

export default function MemberShowcasePage() {
  return (
    <AppShell useTopBar={false} title="" eyebrow="">
      <GreetingHero />

      <div className="mt-6">
        <MemberCard />
      </div>

      <TodaysFocus />

      <FitnessSnapshot />

      <GlassPanel className="mt-5">
        <p className="luxury-label">Your Journey</p>
        <h2 className="mt-2 text-3xl font-black uppercase italic leading-none">
          Recent
          <br />
          Activity
        </h2>

        <div className="mt-5 space-y-4">
          <JourneyItem day="Yesterday" title="Pembroke Fitness" points="+20" />
          <JourneyItem day="Monday" title="Marsa Fitness" points="+20" />
          <JourneyItem day="Sunday" title="Challenge Complete" points="+60" />
        </div>
      </GlassPanel>
    </AppShell>
  );
}

function JourneyItem({
  day,
  title,
  points,
}: {
  day: string;
  title: string;
  points: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-muted">
          {day}
        </p>
        <p className="mt-1 font-black uppercase">{title}</p>
      </div>

      <p className="font-black text-primary">{points} Points</p>
    </div>
  );
}