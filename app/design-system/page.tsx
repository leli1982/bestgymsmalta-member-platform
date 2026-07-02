import {
  Camera,
  CheckCircle2,
  Flame,
  Gift,
  MapPinned,
  QrCode,
  Star,
  Trophy,
  User,
} from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import ProgressBar from "@/components/ui/ProgressBar";
import ProgressRing from "@/components/ui/ProgressRing";
import QuickActionCard from "@/components/ui/QuickActionCard";

export default function DesignSystemPage() {
  return (
    <AppShell useTopBar={false} title="Design System" eyebrow="BestGymsMalta">
      <GlassCard>
        <p className="text-xs font-black uppercase tracking-[0.35em] text-primary">
          UI Kit v1.0
        </p>
        <h1 className="mt-3 text-5xl font-black uppercase italic leading-none">
          BestGymsMalta
          <br />
          Components
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          A premium design system for the official BestGymsMalta app.
        </p>
      </GlassCard>

      <section className="mt-5 grid gap-4">
        <GlassCard>
          <h2 className="mb-4 text-2xl font-black uppercase italic">Buttons</h2>
          <div className="grid gap-3">
            <Button>
              <QrCode size={20} />
              Primary Button
            </Button>
            <Button variant="secondary">
              <Camera size={20} />
              Secondary Button
            </Button>
            <Button variant="ghost">
              <User size={20} />
              Ghost Button
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="bgm-pattern bgm-soft-glow">
          <h2 className="mb-5 text-2xl font-black uppercase italic">
            Progress Ring
          </h2>
          <div className="flex justify-center">
            <ProgressRing value={86} />
          </div>
        </GlassCard>

        <section className="grid grid-cols-4 gap-3">
          <QuickActionCard
            href="/check-in"
            icon={<Camera size={22} />}
            title="Story"
            subtitle="Share"
          />
          <QuickActionCard
            href="/passport"
            icon={<MapPinned size={22} />}
            title="Passport"
            subtitle="Explore"
          />
          <QuickActionCard
            href="/rewards"
            icon={<Gift size={22} />}
            title="Rewards"
            subtitle="Earn"
          />
          <QuickActionCard
            href="/rewards"
            icon={<Trophy size={22} />}
            title="Challenge"
            subtitle="Compete"
          />
        </section>

        <GlassCard>
          <h2 className="mb-4 text-2xl font-black uppercase italic">
            Mission Card
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">
                Today&apos;s Mission
              </p>
              <h3 className="mt-2 text-2xl font-black uppercase">
                Complete a workout
              </h3>
              <p className="mt-2 text-sm text-muted">Reward for today</p>
            </div>

            <div className="rounded-2xl bg-primary px-4 py-3 text-center text-black shadow-glow">
              <p className="text-2xl font-black">+20</p>
              <p className="text-[10px] font-black uppercase">Points</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 text-2xl font-black uppercase italic">
            Reward Progress
          </h2>

          <div className="rounded-[24px] bg-black/50 p-4">
            <p className="text-xs font-black uppercase text-muted">
              Next Reward
            </p>
            <h3 className="mt-2 text-xl font-black uppercase">
              Protein Shake
            </h3>
            <p className="mt-1 text-sm text-muted">1450 / 2000 Points</p>
            <div className="mt-4">
              <ProgressBar value={72} />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 text-2xl font-black uppercase italic">
            Activity Row
          </h2>

          <Activity
            icon={<CheckCircle2 size={20} />}
            day="Yesterday"
            title="Pembroke Fitness"
            points="+20 Points"
          />
          <Activity
            icon={<CheckCircle2 size={20} />}
            day="Monday"
            title="Marsa Fitness"
            points="+20 Points"
          />
          <Activity
            icon={<Star size={20} />}
            day="Sunday"
            title="Challenge Complete"
            points="+60 Points"
          />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 text-2xl font-black uppercase italic">
            Stat Cards
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={<Flame size={22} />} value="12" label="Streak" />
            <MiniStat icon={<Trophy size={22} />} value="1,450" label="Points" />
            <MiniStat icon={<MapPinned size={22} />} value="6/10" label="Gyms" />
          </div>
        </GlassCard>
      </section>
    </AppShell>
  );
}

function Activity({
  icon,
  day,
  title,
  points,
}: {
  icon: React.ReactNode;
  day: string;
  title: string;
  points: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted">{day}</p>
          <p className="font-black">{title}</p>
        </div>
      </div>

      <p className="text-sm font-black text-primary">{points}</p>
    </div>
  );
}

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
    <div className="rounded-[24px] bg-black/50 p-4 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}