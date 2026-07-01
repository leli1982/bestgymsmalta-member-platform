import { Gift } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { rewards } from "@/components/data";

export default function RewardsPage() {
  return (
    <AppShell>
      <p className="text-sm font-black uppercase tracking-[.25em] text-acid">Rewards</p>
      <h1 className="mt-3 text-5xl font-black uppercase leading-none tracking-tighter">Train more. Earn more.</h1>
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.06] p-6">
        <p className="text-xs font-black uppercase tracking-[.25em] text-white/40">Current balance</p>
        <p className="mt-2 text-6xl font-black tracking-tighter text-acid">1,450</p>
        <p className="font-bold text-white/55">points available</p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rewards.map((reward) => (
          <div key={reward.title} className="rounded-3xl border border-white/10 bg-panel p-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-acid text-black shadow-glow">
              <Gift />
            </div>
            <h2 className="mt-5 text-2xl font-black">{reward.title}</h2>
            <p className="mt-1 text-sm font-black uppercase tracking-[.2em] text-white/40">{reward.status}</p>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/[.06] p-4">
              <span className="font-bold text-white/55">Cost</span>
              <span className="text-xl font-black text-acid">{reward.points} pts</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
