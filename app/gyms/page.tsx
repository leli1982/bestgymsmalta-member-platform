import AppShell from "@/components/ui/AppShell";
import { activeGyms, comingSoonGyms, type Gym } from "@/components/data/gyms";
import { ArrowRight, Clock, MapPinned, Navigation } from "lucide-react";

function getMapsUrl(gym: Gym) {
  const mapsQuery =
    typeof gym.latitude === "number" && typeof gym.longitude === "number"
      ? `${gym.latitude},${gym.longitude}`
      : `${gym.name} ${gym.address}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapsQuery
  )}`;
}

function GymCard({ gym }: { gym: Gym }) {
  const mapsUrl = getMapsUrl(gym);

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-white">{gym.name}</h2>

            {gym.status === "coming_soon" ? (
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-orange-500">
                Coming Soon
              </span>
            ) : (
              <span className="rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-green-300">
                Active
              </span>
            )}
          </div>

          <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-5 text-white/55">
            <MapPinned
              className="mt-0.5 shrink-0 text-orange-500"
              size={16}
              strokeWidth={3}
            />
            {gym.address}
          </p>

          <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-5 text-white/55">
            <Clock
              className="mt-0.5 shrink-0 text-orange-500"
              size={16}
              strokeWidth={3}
            />
            {gym.openingHours}
          </p>
        </div>
      </div>

      {gym.facilities.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {gym.facilities.slice(0, 6).map((facility) => (
            <span
              key={facility}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white/60"
            >
              {facility}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm font-bold text-white/40">
          Full gym details coming soon.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-black text-black transition active:scale-95"
        >
          <Navigation size={17} strokeWidth={3} />
          Maps
        </a>

        <a
          href={`/gyms/${gym.id}`}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition active:scale-95"
        >
          Details
          <ArrowRight size={17} strokeWidth={3} />
        </a>
      </div>
    </div>
  );
}

export default function GymsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
          <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
              Gym Locations
            </p>
          </div>

          <h1 className="mt-5 text-4xl font-black leading-tight text-white">
            Find your next BGM gym
          </h1>

          <p className="mt-4 text-sm leading-6 text-white/55">
            Explore BestGymsMalta locations, check opening hours, view
            facilities and open map directions.
          </p>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Active Locations
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Open BGM gyms
            </h2>
          </div>

          <div className="grid gap-4">
            {activeGyms.map((gym) => (
              <GymCard key={gym.id} gym={gym} />
            ))}
          </div>
        </section>

        {comingSoonGyms.length > 0 ? (
          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Coming Soon
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                New locations
              </h2>
            </div>

            <div className="grid gap-4">
              {comingSoonGyms.map((gym) => (
                <GymCard key={gym.id} gym={gym} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
