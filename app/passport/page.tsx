import AppShell from "@/components/ui/AppShell";
import { currentMember } from "@/components/data/member";
import { activeGyms, comingSoonGyms, type Gym } from "@/components/data/gyms";
import {
  CheckCircle2,
  Circle,
  Clock,
  LockKeyhole,
  MapPinned,
  Navigation,
  ShieldCheck,
  Stamp,
} from "lucide-react";

function getMapsUrl(gym: Gym) {
  const mapsQuery =
    typeof gym.latitude === "number" && typeof gym.longitude === "number"
      ? `${gym.latitude},${gym.longitude}`
      : `${gym.name} ${gym.address}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapsQuery
  )}`;
}

function PassportStampCard({
  gym,
  visited,
}: {
  gym: Gym;
  visited: boolean;
}) {
  const mapsUrl = getMapsUrl(gym);

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border p-5 ${
        visited
          ? "border-orange-500/35 bg-orange-500/10"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl" />

      {visited ? (
        <div className="absolute right-4 top-4 rotate-[-10deg] rounded-2xl border-2 border-orange-500/60 px-4 py-2">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-orange-500">
            Stamped
          </p>
        </div>
      ) : null}

      <div className="relative">
        <div
          className={`mb-5 inline-flex rounded-2xl p-3 ${
            visited ? "bg-orange-500 text-black" : "bg-white/10 text-white/35"
          }`}
        >
          {visited ? (
            <Stamp size={26} strokeWidth={3} />
          ) : (
            <LockKeyhole size={26} strokeWidth={3} />
          )}
        </div>

        <h2 className="max-w-[75%] text-2xl font-black leading-tight text-white">
          {gym.name}
        </h2>

        <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-5 text-white/50">
          <MapPinned
            className="mt-0.5 shrink-0 text-orange-500"
            size={16}
            strokeWidth={3}
          />
          {gym.address}
        </p>

        <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-5 text-white/50">
          <Clock
            className="mt-0.5 shrink-0 text-orange-500"
            size={16}
            strokeWidth={3}
          />
          {gym.openingHours}
        </p>

        {gym.facilities.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {gym.facilities.slice(0, 4).map((facility) => (
              <span
                key={facility}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white/55"
              >
                {facility}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href={`/gyms/${gym.id}`}
            className={`flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black transition active:scale-95 ${
              visited
                ? "bg-orange-500 text-black"
                : "border border-white/10 bg-white/[0.04] text-white"
            }`}
          >
            {visited ? (
              <CheckCircle2 size={17} strokeWidth={3} />
            ) : (
              <Circle size={17} strokeWidth={3} />
            )}
            Details
          </a>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-3 text-sm font-black text-white transition active:scale-95"
          >
            <Navigation size={17} strokeWidth={3} />
            Maps
          </a>
        </div>
      </div>
    </div>
  );
}

function ComingSoonPassportCard({ gym }: { gym: Gym }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 opacity-85">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Future Stamp
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">{gym.name}</h2>
          <p className="mt-2 text-sm font-bold text-white/45">
            {gym.address}
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 p-3 text-white/35">
          <LockKeyhole size={24} strokeWidth={3} />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/50">
        {gym.notes || "This gym will be added to the passport once it opens."}
      </p>

      <a
        href={`/gyms/${gym.id}`}
        className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
      >
        View Details
      </a>
    </div>
  );
}

export default function PassportPage() {
  const visitedGymIds = currentMember.passport.visitedGymIds;

  const visitedGyms = activeGyms.filter((gym) => visitedGymIds.includes(gym.id));

  const unvisitedGyms = activeGyms.filter(
    (gym) => !visitedGymIds.includes(gym.id)
  );

  const visitedCount = visitedGyms.length;
  const activeTotal = activeGyms.length;
  const progress =
    activeTotal > 0 ? Math.round((visitedCount / activeTotal) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
          <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
              Membership Passport
            </p>
          </div>

          <h1 className="mt-5 text-4xl font-black leading-tight text-white">
            Your BGM gym journey
          </h1>

          <p className="mt-4 text-sm leading-6 text-white/55">
            Visit BestGymsMalta locations and build your personal digital
            passport.
          </p>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-white/35">
                  Passport Progress
                </p>
                <p className="mt-2 text-4xl font-black text-white">
                  {visitedCount}/{activeTotal}
                </p>
                <p className="mt-1 text-sm font-bold text-white/45">
                  Active BGM gyms stamped
                </p>
              </div>

              <div className="rounded-2xl bg-orange-500 p-3 text-black">
                <ShieldCheck size={30} strokeWidth={3} />
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-sm font-bold text-white/45">
              {progress}% complete
            </p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
            <p className="text-2xl font-black text-white">{visitedCount}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
              Stamped
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
            <p className="text-2xl font-black text-white">
              {unvisitedGyms.length}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
              To Visit
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center">
            <p className="text-2xl font-black text-white">
              {comingSoonGyms.length}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
              Future
            </p>
          </div>
        </section>

        {visitedGyms.length > 0 ? (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Stamped
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Visited gyms
              </h2>
            </div>

            <div className="grid gap-4">
              {visitedGyms.map((gym) => (
                <PassportStampCard key={gym.id} gym={gym} visited />
              ))}
            </div>
          </section>
        ) : null}

        {unvisitedGyms.length > 0 ? (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Next Stamps
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Gyms to visit
              </h2>
            </div>

            <div className="grid gap-4">
              {unvisitedGyms.map((gym) => (
                <PassportStampCard key={gym.id} gym={gym} visited={false} />
              ))}
            </div>
          </section>
        ) : null}

        {comingSoonGyms.length > 0 ? (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Coming Soon
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Future stamps
              </h2>
            </div>

            <div className="grid gap-4">
              {comingSoonGyms.map((gym) => (
                <ComingSoonPassportCard key={gym.id} gym={gym} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
