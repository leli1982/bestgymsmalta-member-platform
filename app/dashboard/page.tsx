import AppShell from "@/components/ui/AppShell";
import { currentMember } from "@/components/data/member";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-bold text-white/45">{detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Your member overview
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Membership, passport, goals and social activity in one place.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Membership"
            value="Active"
            detail={currentMember.membershipLabel}
          />
          <StatCard
            label="Passport"
            value={`${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`}
            detail="BGM gyms visited"
          />
          <StatCard
            label="Streak"
            value={`${currentMember.fitness.streak} days`}
            detail="Training consistency"
          />
          <StatCard
            label="Stories"
            value={currentMember.social.storiesShared.toString()}
            detail="Shared with BGM style"
          />
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Current Goal
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {currentMember.fitness.currentGoal.label}
          </h2>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${currentMember.fitness.currentGoal.progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-bold text-white/45">
            {currentMember.fitness.currentGoal.progress}% progress
          </p>
        </section>
      </div>
    </AppShell>
  );
}
