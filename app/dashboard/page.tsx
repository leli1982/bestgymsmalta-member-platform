import { Flame, QrCode, Share2 } from "lucide-react";
import { AppShell, PrimaryButton, SecondaryButton, StatCard } from "@/components/AppShell";
import { activity } from "@/components/data";

export default function DashboardPage() {
  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-acid">Good evening, Leli</p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-none tracking-tighter sm:text-6xl">
            Ready to beat the rest?
          </h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Streak" value="12 days" detail="Keep the fire going" />
            <StatCard label="Points" value="1,450" detail="350 to next reward" />
            <StatCard label="Home Gym" value="Pembroke" detail="Current location" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <PrimaryButton href="/check-in"><QrCode size={20} /> Check In</PrimaryButton>
            <SecondaryButton href="/check-in"><Share2 size={20} /> Create Story</SecondaryButton>
          </div>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.06] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.25em] text-white/40">Next reward</p>
                <h2 className="mt-2 text-2xl font-black">Top Supplements Voucher</h2>
              </div>
              <Flame className="text-acid" />
            </div>
            <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-acid shadow-glow" />
            </div>
            <p className="mt-3 text-sm font-bold text-white/50">350 points to unlock</p>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-panel p-5">
          <p className="text-xs font-black uppercase tracking-[.25em] text-acid">Recent activity</p>
          <div className="mt-5 space-y-3">
            {activity.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white/[.06] p-4">
                <p className="text-sm font-bold text-white/75">{item.label}</p>
                <p className="font-black text-acid">{item.points}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
