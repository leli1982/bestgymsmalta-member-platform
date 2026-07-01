import { Trophy } from "lucide-react";
import { AppShell, GymBadge } from "@/components/AppShell";
import { gyms } from "@/components/data";

export default function PassportPage() {
  const visited = gyms.filter((gym) => gym.visited).length;
  return (
    <AppShell>
      <p className="text-sm font-black uppercase tracking-[.25em] text-acid">Gym passport</p>
      <h1 className="mt-3 text-5xl font-black uppercase leading-none tracking-tighter">Collect every BestGymsMalta location.</h1>
      <div className="mt-8 rounded-3xl border border-acid/25 bg-acid/10 p-6 shadow-glow">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-acid text-black"><Trophy /></div>
          <div>
            <p className="text-4xl font-black tracking-tighter">{visited} / {gyms.length}</p>
            <p className="font-bold text-white/60">gyms unlocked</p>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gyms.map((gym) => (
          <GymBadge key={gym.name} {...gym} />
        ))}
      </div>
    </AppShell>
  );
}
