import AppShell from "@/components/ui/AppShell";
import { currentMember } from "@/components/data/member";

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-zinc-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-zinc-500">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell theme="light">
      <div data-member-surface="dashboard-light" className="space-y-6 text-zinc-950">
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 shadow-xl">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">Dashboard</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">Your member overview</h1>
            <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/60">Membership, passport, goals and social activity in one place.</p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Membership" value="Active" detail={currentMember.membershipLabel} />
          <StatCard label="Passport" value={`${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`} detail="BGM gyms visited" />
          <StatCard label="Streak" value={`${currentMember.fitness.streak} days`} detail="Training consistency" />
          <StatCard label="Stories" value={currentMember.social.storiesShared.toString()} detail="Shared with BGM style" />
        </div>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Current Goal</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">{currentMember.fitness.currentGoal.label}</h2>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-[#ff5a0a]" style={{ width: `${currentMember.fitness.currentGoal.progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-bold">
            <span className="text-zinc-500">Keep moving forward</span>
            <span className="text-[#ff5a0a]">{currentMember.fitness.currentGoal.progress}%</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
