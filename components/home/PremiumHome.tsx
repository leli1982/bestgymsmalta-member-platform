import {
  Camera,
  CreditCard,
  Dumbbell,
  Flame,
  MapPinned,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { currentMember } from "@/components/data/member";
import QuickActionCard from "@/components/ui/QuickActionCard";

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

export default function PremiumHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
          <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
            Active Membership
          </p>
        </div>

        <h1 className="mt-5 text-4xl font-black leading-tight text-white">
          Welcome back, {currentMember.firstName}
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/55">
          Your membership card, passport, gym locations, goals, virtual trainer
          and BGM story creator are ready.
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-white/35">
                Membership
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {currentMember.membershipLabel}
              </p>
              <p className="mt-1 text-sm font-bold text-white/45">
                {currentMember.membershipNumber}
              </p>
            </div>

            <div className="rounded-2xl bg-orange-500 p-3 text-black">
              <ShieldCheck size={28} strokeWidth={3} />
            </div>
          </div>
        </div>
      </section>

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
      </div>

      <section>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
          Quick Actions
        </p>

        <div className="grid grid-cols-2 gap-3">
          <QuickActionCard
            href="/card"
            icon={<CreditCard size={24} />}
            title="Card"
            subtitle="NFC-ready"
          />

          <QuickActionCard
            href="/check-in"
            icon={<QrCode size={24} />}
            title="Check-In"
            subtitle="Confirm visit"
          />

          <QuickActionCard
            href="/passport"
            icon={<MapPinned size={24} />}
            title="Passport"
            subtitle="Your journey"
          />

          <QuickActionCard
            href="/gyms"
            icon={<Dumbbell size={24} />}
            title="Gyms"
            subtitle="Locations"
          />

          <QuickActionCard
            href="/trainer"
            icon={<Sparkles size={24} />}
            title="Trainer"
            subtitle="Workout help"
          />

          <QuickActionCard
            href="/story"
            icon={<Camera size={24} />}
            title="Story"
            subtitle="Share"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
          Member Journey
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Recent activity
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
  );
}
