"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  ExternalLink,
  MapPinned,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { getVirtualTourUrl } from "@/lib/gymVirtualTours";

type Gym = {
  id: string;
  name: string;
  status?: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  logo?: string;
  coverImage?: string;
  cover_image?: string;
  virtualTourUrl?: string | null;
  virtual_tour_url?: string | null;
};

function getCoverImage(gym: Gym) {
  return gym.coverImage || gym.cover_image || "/visuals/gyms.jpg";
}

function getMapsUrl(gym: Gym) {
  if (typeof gym.latitude === "number" && typeof gym.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${gym.latitude},${gym.longitude}`
    )}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${gym.name} ${gym.address || ""}`
  )}`;
}

export default function GymTourPage({ gymId }: { gymId: string }) {
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
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading 3D tour…</p>
        </div>
      </section>
    );
  }

  if (!gym) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
        <Box className="mx-auto text-[#fcb415]" size={42} strokeWidth={3} />

        <h1 className="mt-4 text-3xl font-black text-white">Tour not found</h1>

        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          This gym tour could not be found.
        </p>

        <a
          href="/gyms"
          className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          Back to Gyms
        </a>
      </section>
    );
  }

  const tourUrl = getVirtualTourUrl(gym);

  if (!tourUrl) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
        <Box className="mx-auto text-[#fcb415]" size={42} strokeWidth={3} />

        <h1 className="mt-4 text-3xl font-black text-white">
          3D tour coming soon
        </h1>

        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          This location does not have a virtual tour yet.
        </p>

        <a
          href={`/gyms/${gym.id}`}
          className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          Back to Gym
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <a
        href={`/gyms/${gym.id}`}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white"
      >
        <ArrowLeft size={17} strokeWidth={3} />
        Back to {gym.name}
      </a>

      <section
        className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-5 shadow-2xl"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.86)), linear-gradient(135deg, rgba(252,180,21,.18), rgba(0,0,0,.78)), url('${getCoverImage(
            gym
          )}')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/88" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                3D Virtual Tour
              </p>

              <h1 className="mt-3 text-4xl font-black leading-tight text-white drop-shadow-2xl">
                Explore {gym.name}
              </h1>
            </div>

            {gym.logo ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/45 p-2 backdrop-blur-md">
                <img src={gym.logo} alt="" className="h-full w-full object-contain" />
              </div>
            ) : null}
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-6 text-white/65">
            <MapPinned
              className="mt-0.5 shrink-0 text-[#fcb415]"
              size={17}
              strokeWidth={3}
            />
            {gym.address || gym.city || "BestGymsMalta location"}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
        <div className="relative h-[68vh] min-h-[520px] w-full">
          <iframe
            src={tourUrl}
            title={`${gym.name} 3D Virtual Tour`}
            allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <a
          href={getMapsUrl(gym)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          <Navigation size={17} strokeWidth={3} />
          Directions
        </a>

        <a
          href={tourUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
        >
          <ExternalLink size={17} strokeWidth={3} />
          Open Fullscreen
        </a>
      </section>
    </div>
  );
}
