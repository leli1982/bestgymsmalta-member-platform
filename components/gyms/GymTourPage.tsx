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
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading 3D tour…</p>
        </div>
      </section>
    );
  }

  if (!gym) {
    return (
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-center">
        <Box className="mx-auto text-[#c2410c]" size={42} strokeWidth={3} />

        <h1 className="mt-4 text-3xl font-black text-zinc-950">Tour not found</h1>

        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          This gym tour could not be found.
        </p>

        <a
          href="/gyms"
          className="mt-5 flex items-center justify-center rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white"
        >
          Back to Gyms
        </a>
      </section>
    );
  }

  const tourUrl = getVirtualTourUrl(gym);

  if (!tourUrl) {
    return (
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-center">
        <Box className="mx-auto text-[#c2410c]" size={42} strokeWidth={3} />

        <h1 className="mt-4 text-3xl font-black text-zinc-950">
          3D tour coming soon
        </h1>

        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          This location does not have a virtual tour yet.
        </p>

        <a
          href={`/gyms/${gym.id}`}
          className="mt-5 flex items-center justify-center rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white"
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
        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-950"
      >
        <ArrowLeft size={17} strokeWidth={3} />
        Back to {gym.name}
      </a>


      <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#c2410c]">3D virtual tour</p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-zinc-950">Explore {gym.name}</h1>
        <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
          <MapPinned className="mt-1 shrink-0 text-[#ff5a0a]" size={17} />
          {gym.address || gym.city || "BestGymsMalta location"}
        </p>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
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
          className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white"
        >
          <Navigation size={17} strokeWidth={3} />
          Directions
        </a>

        <a
          href={tourUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-4 text-sm font-black text-zinc-950"
        >
          <ExternalLink size={17} strokeWidth={3} />
          Open Fullscreen
        </a>
      </section>
    </div>
  );
}
