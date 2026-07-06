import AppShell from "@/components/ui/AppShell";
import MemberCard from "@/components/member/MemberCard";

function JourneyItem({
  day,
  title,
  detail,
}: {
  day: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">
          {day}
        </p>
        <p className="mt-1 font-black text-white">{title}</p>
      </div>

      <p className="font-black text-[#fcb415]">{detail}</p>
    </div>
  );
}

export default function MemberShowcasePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#fcb415]">
            Member Showcase
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Social member experience
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Membership card, passport progress and shareable BGM activity.
          </p>
        </div>

        <MemberCard />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Member Journey
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Recent activity
          </h2>

          <div className="mt-5 space-y-3">
            <JourneyItem
              day="Yesterday"
              title="Pembroke Fitness"
              detail="Checked in"
            />
            <JourneyItem day="Monday" title="Marsa Fitness" detail="Visited" />
            <JourneyItem day="Sunday" title="BGM Story" detail="Shared" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
