import AppShell from "@/components/ui/AppShell";
import { gyms } from "@/components/data/gyms";
import { MapPinned } from "lucide-react";

type GymRecord = {
  id?: string;
  name?: string;
  title?: string;
  location?: unknown;
  area?: unknown;
  address?: unknown;
  description?: unknown;
  facilities?: unknown;
};

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  return "";
}

export default function GymsPage() {
  const gymList = gyms as GymRecord[];

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
            Explore BestGymsMalta locations and open directions when you are
            ready to train.
          </p>
        </section>

        <div className="grid gap-4">
          {gymList.map((gym) => {
            const gymId = gym.id ?? gym.name ?? gym.title ?? "bgm-gym";
            const gymName = gym.name ?? gym.title ?? "BestGymsMalta Gym";

            const locationText =
              toText(gym.location) ||
              toText(gym.area) ||
              toText(gym.address) ||
              "Malta";

            const descriptionText = toText(gym.description);
            const facilitiesText = toText(gym.facilities);

            const mapQuery = encodeURIComponent(`${gymName} ${locationText}`);

            return (
              <div
                key={gymId}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {gymName}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-white/50">
                      {locationText}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500">
                    <MapPinned size={22} strokeWidth={3} />
                  </div>
                </div>

                {descriptionText ? (
                  <p className="mt-4 text-sm leading-6 text-white/60">
                    {descriptionText}
                  </p>
                ) : null}

                {facilitiesText ? (
                  <p className="mt-3 text-xs font-bold uppercase tracking-[.16em] text-white/35">
                    {facilitiesText}
                  </p>
                ) : null}

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
                >
                  Open in Maps
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}