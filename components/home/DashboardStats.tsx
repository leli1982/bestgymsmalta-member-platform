import { Dumbbell, Flame, Trophy } from "lucide-react";
import StatCard from "@/components/ui/StatCard";

export default function DashboardStats() {
  return (
    <section className="mt-5 grid grid-cols-3 gap-3">
      <StatCard icon={<Flame size={22} />} value="12" label="Streak" />
      <StatCard icon={<Trophy size={22} />} value="1,450" label="Points" />
      <StatCard icon={<Dumbbell size={22} />} value="6/10" label="Gyms" />
    </section>
  );
}