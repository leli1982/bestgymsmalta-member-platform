import AppShell from "@/components/ui/AppShell";

export default function GoalsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            Fitness Goals
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Track your progress
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Set simple goals, track consistency and stay focused on becoming
            the best version of yourself.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-lg font-black text-white">Current goal</p>
          <p className="mt-2 text-sm text-white/55">
            Build strength and stay consistent.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
