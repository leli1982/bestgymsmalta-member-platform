import { Camera, Flame, MapPinned, Trophy } from "lucide-react";
import { currentMember } from "@/components/data/member";

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-orange-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-white/35">
        {label}
      </p>
    </div>
  );
}

export default function DashboardStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <MiniStat
        icon={<MapPinned size={22} />}
        value={`${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`}
        label="Gyms Visited"
      />

      <MiniStat
        icon={<Flame size={22} />}
        value={currentMember.fitness.streak.toString()}
        label="Day Streak"
      />

      <MiniStat
        icon={<Trophy size={22} />}
        value={currentMember.fitness.score.toString()}
        label="Fitness Score"
      />

      <MiniStat
        icon={<Camera size={22} />}
        value={currentMember.social.storiesShared.toString()}
        label="Stories Shared"
      />
    </div>
  );
}
