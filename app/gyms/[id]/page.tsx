import AppShell from "@/components/ui/AppShell";
import { getGymById, gyms } from "@/components/data/gyms";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Dumbbell,
  Mail,
  MapPinned,
  Navigation,
  Phone,
} from "lucide-react";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return gyms.map((gym) => ({
    id: gym.id,
  }));
}

export default async function GymDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gym = getGymById(id);

  if (!gym) {
    notFound();
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${gym.name} ${gym.address}`
  )}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <a
          href="/gyms"
          className="inline-flex items-center gap-2 text-sm font-black text-white/50"
        >
          <ArrowLeft size={17} strokeWidth={3} />
          Back to gyms
        </a>

        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-orange-500">
            {gym.status === "active" ? "Active Location" : "Coming Soon"}
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight text-white">
            {gym.name}
          </h1>

          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-white/55">
            <MapPinned size={16} strokeWidth={3} />
            {gym.address}
          </p>

          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-white/55">
            <Clock size={16} strokeWidth={3} />
            {gym.openingHours}
          </p>

          {gym.notes ? (
            <p className="mt-5 text-sm leading-6 text-white/60">{gym.notes}</p>
          ) : (
            <p className="mt-5 text-sm leading-6 text-white/60">
              Train at {gym.name} as part of the BestGymsMalta member platform.
              More detailed information will be added here as the app grows.
            </p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95"
          >
            <Navigation size={18} strokeWidth={3} />
            Open Directions
          </a>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500">
              <Dumbbell size={22} strokeWidth={3} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Facilities
              </p>
              <h2 className="text-xl font-black text-white">Gym features</h2>
            </div>
          </div>

          {gym.facilities.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {gym.facilities.map((facility) => (
                <div
                  key={facility}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <CheckCircle2
                    className="text-orange-500"
                    size={20}
                    strokeWidth={3}
                  />
                  <p className="font-bold text-white/75">{facility}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm font-bold text-white/45">
              Facilities will be listed soon.
            </p>
          )}
        </section>

        {gym.classes.length > 0 ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Classes
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              Available sessions
            </h2>

            <div className="mt-5 flex flex-wrap gap-2">
              {gym.classes.map((gymClass) => (
                <span
                  key={gymClass}
                  className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-white/65"
                >
                  {gymClass}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {(gym.phone || gym.email) && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Contact
            </p>

            <div className="mt-5 grid gap-3">
              {gym.phone ? (
                <a
                  href={`tel:${gym.phone}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <Phone className="text-orange-500" size={20} />
                  <span className="font-bold text-white/75">{gym.phone}</span>
                </a>
              ) : null}

              {gym.email ? (
                <a
                  href={`mailto:${gym.email}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <Mail className="text-orange-500" size={20} />
                  <span className="font-bold text-white/75">{gym.email}</span>
                </a>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
