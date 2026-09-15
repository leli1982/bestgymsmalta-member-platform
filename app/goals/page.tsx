import { Dumbbell, Target } from "lucide-react";
import AppShell from "@/components/ui/AppShell";

export default function GoalsPage() {
  return (
    <AppShell theme="light">
      <div data-member-surface="goals-light" className="space-y-6 text-zinc-950">
        <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 shadow-xl">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">
                Fitness Goals
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white">
                Track your progress
              </h1>
              <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/60">
                Set simple goals, track consistency and stay focused on becoming
                the best version of yourself.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white">
              <Target size={28} strokeWidth={3} />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]">
              <Dumbbell size={27} strokeWidth={3} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-[#ff5a0a]">
                Current goal
              </p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">
                Build strength and stay consistent.
              </h2>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-500">
                Keep showing up, build gradually and use your training tools to
                stay focused on the goal.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
