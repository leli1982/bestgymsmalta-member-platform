import {
  Camera,
  CheckCircle2,
  Gift,
  MapPinned,
  QrCode,
  Star,
  Trophy,
} from "lucide-react";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";
import ProgressBar from "@/components/ui/ProgressBar";
import ProgressRing from "@/components/ui/ProgressRing";
import QuickActionCard from "@/components/ui/QuickActionCard";

export default function PremiumHome() {
  return (
    <>
      <GlassPanel variant="hero" className="orange-halo">
        <div className="flex items-start justify-between gap-5">
          <div className="flex-1">
            <p className="luxury-label">Main Action</p>

            <h2 className="mt-4 text-7xl font-black uppercase italic leading-[0.82] tracking-tighter">
              Check
              <br />
              In
            </h2>

            <p className="mt-4 max-w-[240px] text-base leading-relaxed text-zinc-400">
              Scan your gym QR code, keep your streak alive and earn more
              points.
            </p>
          </div>

          <div className="icon-token h-24 w-24 rounded-[28px]">
            <QrCode size={46} />
          </div>
        </div>

        <div className="mt-8">
          <Button href="/check-in" className="w-full text-lg">
            <QrCode size={22} />
            Check In
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="luxury-label">Today&apos;s Mission</p>
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
      </GlassPanel>

      <section className="mt-5 grid grid-cols-4 gap-3">
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

      <GlassPanel className="mt-5 bgm-pattern bgm-soft-glow">
        <p className="luxury-label">Your Progress</p>

        <div className="mt-5 grid grid-cols-[130px_1fr] gap-4">
          <div className="flex items-center justify-center">
            <ProgressRing value={86} />
          </div>

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
        </div>
      </GlassPanel>

      <GlassPanel className="mt-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="luxury-section-title text-2xl">Latest Activity</h2>
          <p className="text-sm font-black text-primary">View all</p>
        </div>

        <Activity
          icon={<CheckCircle2 size={20} />}
          day="Yesterday"
          title="Pembroke Fitness"
          points="+20"
        />
        <Activity
          icon={<CheckCircle2 size={20} />}
          day="Monday"
          title="Marsa Fitness"
          points="+20"
        />
        <Activity
          icon={<Star size={20} />}
          day="Sunday"
          title="Challenge Complete"
          points="+60"
        />
      </GlassPanel>
    </>
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
    <div className="relative flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        <div className="icon-token h-10 w-10 rounded-full">{icon}</div>

        <div>
          <p className="text-xs text-muted">{day}</p>
          <p className="font-black">{title}</p>
        </div>
      </div>

      <p className="font-black text-primary">{points} Points</p>
    </div>
  );
}