import AppShell from "@/components/ui/AppShell";
import MemberCard from "@/components/member/MemberCard";

function JourneyItem({ day, title, detail }: { day: string; title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-zinc-400">{day}</p>
        <p className="mt-1 font-black text-zinc-950">{title}</p>
      </div>
      <p className="shrink-0 text-sm font-black text-[#ff5a0a]">{detail}</p>
    </div>
  );
}

export default function MemberShowcasePage() {
  return (
    <AppShell theme="light">
      <div data-member-surface="community-light" className="space-y-6 text-zinc-950">
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 shadow-xl">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">Community</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">Your BGM journey</h1>
            <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/60">Your membership card, passport progress and shareable BGM activity together.</p>
          </div>
        </section>

        <MemberCard />

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Member Journey</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">Recent activity</h2>
          <div className="mt-5 space-y-3">
            <JourneyItem day="Yesterday" title="Pembroke Fitness" detail="Checked in" />
            <JourneyItem day="Monday" title="Marsa Fitness" detail="Visited" />
            <JourneyItem day="Sunday" title="BGM Story" detail="Shared" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
