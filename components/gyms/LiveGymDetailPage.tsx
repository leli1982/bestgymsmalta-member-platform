"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Mail,
  MapPinned,
  Navigation,
  Phone,
  RefreshCw,
} from "lucide-react";
import type { Gym } from "@/components/data/gyms";

function getMapsUrl(gym: Gym) {
  const mapsQuery =
    typeof gym.latitude === "number" && typeof gym.longitude === "number"
      ? `${gym.latitude},${gym.longitude}`
      : `${gym.name} ${gym.address}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapsQuery
  )}`;
}

export default function LiveGymDetailPage({ gymId }: { gymId: string }) {
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGym() {
      try {
        const response = await fetch("/api/gyms", {
          cache: "no-store",
        });

        const data = await response.json();
        const foundGym = (data.gyms || []).find((item: Gym) => item.id === gymId);

        setGym(foundGym || null);
      } catch {
        setGym(null);
      } finally {
        setLoading(false);
      }
    }

    loadGym();
  }, [gymId]);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading gym details…</p>
        </div>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="space-y-5">
        <a
          href="/gyms"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
        >
          <ArrowLeft size={17} strokeWidth={3} />
          Back to Gyms
        </a>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h1 className="text-3xl font-black text-white">Gym not found</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            This gym could not be loaded.
          </p>
        </section>
      </div>
    );
  }

  const mapsUrl = getMapsUrl(gym);

  return (
    <div className="space-y-6">
      <a
        href="/gyms"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
      >
        <ArrowLeft size={17} strokeWidth={3} />
        Back to Gyms
      </a>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-500">
                {gym.status === "coming_soon" ? "Coming Soon" : "Active Gym"}
              </p>
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight text-white">
              {gym.name}
            </h1>

            <p className="mt-4 text-sm font-bold leading-6 text-white/55">
              {gym.notes || "Part of the BestGymsMalta member network."}
            </p>
          </div>

          {gym.logo ? (
            <img
              src={gym.logo}
              alt=""
              className="h-20 w-20 shrink-0 object-contain"
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
          Location
        </p>

        <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-6 text-white/55">
          <MapPinned className="mt-0.5 text-orange-500" size={17} strokeWidth={3} />
          {gym.address}
        </p>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <Navigation size={18} strokeWidth={3} />
          Open Maps
        </a>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
          Opening Hours
        </p>

        <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-6 text-white/55">
          <Clock className="mt-0.5 text-orange-500" size={17} strokeWidth={3} />
          {gym.openingHours || "Opening hours coming soon"}
        </p>
      </section>

      {(gym.phone || gym.email) ? (
        <section className="grid gap-3">
          {gym.phone ? (
            <a
              href={`tel:${gym.phone}`}
              className="flex items-center gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-white"
            >
              <Phone className="text-orange-500" size={22} strokeWidth={3} />
              <span className="text-sm font-black">{gym.phone}</span>
            </a>
          ) : null}

          {gym.email ? (
            <a
              href={`mailto:${gym.email}`}
              className="flex items-center gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-white"
            >
              <Mail className="text-orange-500" size={22} strokeWidth={3} />
              <span className="text-sm font-black">{gym.email}</span>
            </a>
          ) : null}
        </section>
      ) : null}

      {gym.facilities.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Facilities
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {gym.facilities.map((facility) => (
              <span
                key={facility}
                className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white/60"
              >
                {facility}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {gym.classes.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            Classes
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {gym.classes.map((className) => (
              <span
                key={className}
                className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-500"
              >
                {className}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <a
        href="/story"
        className="flex items-center justify-center rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
      >
        Create Story
      </a>
    </div>
  );
}
