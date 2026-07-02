import AppShell from "@/components/ui/AppShell";
import { currentMember } from "@/components/data/member";
import { gyms } from "@/components/data/gyms";
import { CheckCircle2, Circle, MapPinned, ShieldCheck } from "lucide-react";

type GymRecord = {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  location?: unknown;
  area?: unknown;
};

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return "";
}

export default function PassportPage() {
  const gymList = gyms as GymRecord[];

  const visitedGymIds = currentMember.passport.visitedGymIds;
  const visitedCount = currentMember.passport.gymsVisited;
  const totalGyms = currentMember.passport.totalGyms;
  const progress = Math.round((visitedCount / totalGyms) * 100);

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
            Visit BestGymsMalta locations across Malta and build your personal
            gym passport.
          </p>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-white/35">
                  Passport Progress
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {visitedCount}/{totalGyms}
                </p>
                <p className="mt-1 text-sm font-bold text-white/45">
                  BGM gyms visited
                </p>
              </div>

              <div className="rounded-2xl bg-orange-500 p-3 text-black">
                <ShieldCheck size={28} strokeWidth={3} />
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

        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              BGM Locations
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Passport stamps
            </h2>
          </div>

          <div className="grid gap-3">
            {gymList.map((gym) => {
              const gymId = gym.id ?? gym.slug ?? gym.name ?? gym.title ?? "bgm-gym";
              const gymName = gym.name ?? gym.title ?? "BestGymsMalta Gym";
              const gymLocation =
                toText(gym.location) || toText(gym.area) || "Malta";
              const isVisited = visitedGymIds.includes(gymId);

              return (
                <div
                  key={gymId}
                  className={`rounded-3xl border p-5 ${
                    isVisited
                      ? "border-orange-500/30 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-white">
                        {gymName}
                      </p>
                      <p className="mt-1 text-sm font-bold text-white/45">
                        {gymLocation}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl p-3 ${
                        isVisited
                          ? "bg-orange-500 text-black"
                          : "bg-white/10 text-white/35"
                      }`}
                    >
                      {isVisited ? (
                        <CheckCircle2 size={22} strokeWidth={3} />
                      ) : (
                        <Circle size={22} strokeWidth={3} />
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p
                      className={`text-xs font-black uppercase tracking-[.2em] ${
                        isVisited ? "text-orange-500" : "text-white/35"
                      }`}
                    >
                      {isVisited ? "Visited" : "Not visited yet"}
                    </p>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        gymName + " " + gymLocation
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-white"
                    >
                      <MapPinned size={15} strokeWidth={3} />
                      Maps
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
