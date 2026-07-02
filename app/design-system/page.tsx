import AppShell from "@/components/ui/AppShell";
import {
  Camera,
  CreditCard,
  Dumbbell,
  Flame,
  MapPinned,
  ShieldCheck,
} from "lucide-react";

function FeatureCard({
  href,
  title,
  text,
  icon,
}: {
  href: string;
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-3 text-orange-500">
        {icon}
      </div>

      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
    </a>
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-orange-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-white/35">
        {label}
      </p>
    </div>
  );
}

function JourneyItem({
  day,
  title,
  detail,
}: {
  day: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/35">
          {day}
        </p>
        <p className="mt-1 font-black text-white">{title}</p>
      </div>

      <p className="text-sm font-black text-orange-500">{detail}</p>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
          <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
              BestGymsMalta
            </p>
          </div>

          <h1 className="mt-5 text-4xl font-black leading-tight text-white">
            Premium member platform
          </h1>

          <p className="mt-4 text-sm leading-6 text-white/55">
            Membership status, passport progress, gym finder, fitness goals and
            social story creation.
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            icon={<MapPinned size={22} />}
            value="6/10"
            label="Gyms Visited"
          />
          <MiniStat icon={<Flame size={22} />} value="12" label="Day Streak" />
          <MiniStat
            icon={<ShieldCheck size={22} />}
            value="Active"
            label="Membership"
          />
          <MiniStat icon={<Camera size={22} />} value="18" label="Stories" />
        </div>

        <div className="grid gap-3">
          <FeatureCard
            href="/card"
            title="Membership Card"
            text="NFC-ready member card and active membership status."
            icon={<CreditCard size={24} strokeWidth={3} />}
          />

          <FeatureCard
            href="/passport"
            title="Passport"
            text="Track visited BGM gyms across Malta."
            icon={<MapPinned size={24} strokeWidth={3} />}
          />

          <FeatureCard
            href="/gyms"
            title="Gym Locations"
            text="Browse locations and open map directions."
            icon={<Dumbbell size={24} strokeWidth={3} />}
          />

          <FeatureCard
            href="/story"
            title="Story Creator"
            text="Create branded social posts with the BGM watermark."
            icon={<Camera size={24} strokeWidth={3} />}
          />
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Journey
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Recent member activity
          </h2>

          <div className="mt-5 space-y-3">
            <JourneyItem
              day="Yesterday"
              title="Pembroke Fitness"
              detail="Checked in"
            />
            <JourneyItem day="Monday" title="Marsa Fitness" detail="Visited" />
            <JourneyItem day="Sunday" title="BGM Story" detail="Shared" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
