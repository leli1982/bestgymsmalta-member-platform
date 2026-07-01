import GlassPanel from "@/components/ui/GlassPanel";
import { memberStats } from "@/components/data/stats";

export default function FitnessSnapshot() {
  return (
    <section className="mt-5">
      <div className="mb-3">
        <p className="luxury-label">Fitness Snapshot</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {memberStats.map((stat) => (
          <GlassPanel key={stat.id} variant="compact">
            <div className="text-center">
              <p className="text-3xl">{stat.icon}</p>
              <p className="mt-3 text-4xl font-black uppercase italic leading-none">
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.25em] text-muted">
                {stat.label}
              </p>
            </div>
          </GlassPanel>
        ))}
      </div>
    </section>
  );
}
