import { CreditCard, Dumbbell, MapPinned, ShieldCheck } from "lucide-react";
import { currentMember } from "@/components/data/member";

function formatStatus(status: string) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return "Expired";
}

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

export default function MemberCard() {
  const status = formatStatus(currentMember.status);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.28em] text-orange-500">
            BestGymsMalta
          </p>
          <h2 className="mt-3 text-3xl font-black text-white">
            {currentMember.fullName}
          </h2>
          <p className="mt-1 text-sm font-bold text-white/50">
            {currentMember.membershipLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-orange-500">
          <CreditCard size={26} strokeWidth={3} />
        </div>
      </div>

      <div className="mt-7 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-white/35">
              Membership Number
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {currentMember.membershipNumber}
            </p>
          </div>

          <div className="rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2">
            <p className="text-xs font-black uppercase tracking-[.18em] text-green-300">
              {status}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <ShieldCheck className="text-orange-500" size={22} strokeWidth={3} />
          <div>
            <p className="text-sm font-black text-white">NFC-ready card</p>
            <p className="text-xs font-bold text-white/45">
              Card ID: {currentMember.nfcCard.cardId}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatItem
          label="Passport"
          value={`${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`}
        />
        <StatItem label="Fitness Score" value={currentMember.fitness.score} />
        <StatItem label="Streak" value={`${currentMember.fitness.streak} days`} />
        <StatItem label="Workouts" value={currentMember.fitness.totalWorkouts} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href="/passport"
          className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95"
        >
          <MapPinned size={18} strokeWidth={3} />
          Open Passport
        </a>

        <a
          href="/goals"
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white transition active:scale-95"
        >
          <Dumbbell size={18} strokeWidth={3} />
          Fitness Goals
        </a>
      </div>
    </section>
  );
}
