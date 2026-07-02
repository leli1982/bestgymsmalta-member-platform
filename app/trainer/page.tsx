import AppShell from "@/components/ui/AppShell";

export default function TrainerPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            Virtual Trainer
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Your training companion
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Suggested workouts, simple guidance and goal-based training support.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-lg font-black text-white">Today&apos;s focus</p>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Start with a warm-up, complete your main workout and finish with
            mobility work.
          </p>
        </div>
      </div>
    </AppShell>
  );
}