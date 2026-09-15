"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  Dumbbell,
  MapPinned,
  Navigation,
  RefreshCw,
  Search,
  Box,
} from "lucide-react";

type Gym = {
  id: string;
  name: string;
  shortName?: string;
  short_name?: string;
  status?: string;
  city?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: string;
  opening_hours?: string;
  phone?: string;
  email?: string;
  logo?: string;
  coverImage?: string;
  cover_image?: string;
  virtualTourUrl?: string;
  virtual_tour_url?: string;
  facilities?: string[];
  classes?: string[];
  featuredEquipment?: string[];
  featured_equipment?: string[];
};

function getOpeningHours(gym: Gym) {
  return gym.openingHours || gym.opening_hours || "";
}

const gymCoverImages: Record<string, string> = {
  "bgm-birkirkara": "/visuals/gyms/birkirkara.jpg",
  "bgm-birzebbuga": "/visuals/gyms/birzebbuga.jpg",
  "bgm-build": "/visuals/gyms/build.jpg",
  "bgm-kirkop": "/visuals/gyms/kirkop.jpg",
  "bgm-marsa": "/visuals/gyms/marsa.jpg",
  "bgm-marsascala": "/visuals/gyms/marsascala.jpg",
  "bgm-neptunes": "/visuals/gyms/neptunes.jpg",
  "bgm-pembroke": "/visuals/gyms/pembroke.jpg",
  "bgm-sliema": "/visuals/gyms/sliema.jpg",
  "bgm-talqroqq": "/visuals/gyms/talqroqq.jpg",
  "bgm-birgu": "/visuals/gyms/birgu.jpg",
};

function getCoverImage(gym: Gym) {
  return (
    gym.coverImage ||
    gym.cover_image ||
    gymCoverImages[gym.id] ||
    "/visuals/gyms.jpg"
  );
}


const gymTourLinks: Record<string, string> = {
  "bgm-talqroqq": "https://my.matterport.com/show/?m=mcqf1r934fB&play=1&qs=1",
  "bgm-birkirkara": "https://my.matterport.com/show/?m=yo8dbfqbqHQ&play=1&qs=1",
  "bgm-birzebbuga": "https://my.matterport.com/show/?m=6qK39DQ1379&play=1&qs=1",
  "bgm-build": "https://my.matterport.com/show/?m=ffCPVyFjR3P&play=1&qs=1",
  "bgm-kirkop": "https://my.matterport.com/show/?m=ZQRMmgRHk6G&play=1&qs=1",
  "bgm-marsa": "https://my.matterport.com/show/?m=xceozbh8LwW&play=1&qs=1",
  "bgm-neptunes": "https://my.matterport.com/show/?m=gLS3C2Gi5cF&play=1&qs=1",
  "bgm-pembroke": "https://my.matterport.com/show/?m=Pgd6FYMgZ2t&play=1&qs=1",
  "bgm-sliema": "https://my.matterport.com/show/?m=RXM25JipdP9&play=1&qs=1",
};

function getVirtualTourUrl(gym: Gym) {
  return (
    gym.virtualTourUrl ||
    gym.virtual_tour_url ||
    gymTourLinks[gym.id] ||
    ""
  );
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

function statusLabel(status?: string) {
  if (status === "coming_soon") return "Coming Soon";
  if (status === "inactive") return "Inactive";
  return "Open";
}

export default function LiveGymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadGyms() {
      try {
        const response = await fetch("/api/gyms", {
          cache: "no-store",
        });

        const data = await response.json();
        setGyms(data.gyms || []);
      } catch {
        setGyms([]);
      } finally {
        setLoading(false);
      }
    }

    loadGyms();
  }, []);

  const filteredGyms = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return gyms;

    return gyms.filter((gym) => {
      return `${gym.name} ${gym.city || ""} ${gym.address || ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [gyms, query]);

  const activeCount = gyms.filter((gym) => gym.status === "active").length;


  return (
    <div className="space-y-6">
      <header
        data-gym-hero="network"
        className="relative min-h-[270px] overflow-hidden rounded-[2rem] bg-zinc-950 text-white shadow-[0_14px_36px_rgba(15,23,42,0.16)]"
      >
        <Image
          src="/visuals/gyms.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 448px) calc(100vw - 40px), 408px"
          className="object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.92)_0%,rgba(0,0,0,.72)_48%,rgba(0,0,0,.22)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

        <div className="relative flex min-h-[270px] flex-col justify-between p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-[.2em] text-orange-300 backdrop-blur-sm">
              Our locations
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-orange-300 backdrop-blur-sm">
              <MapPinned size={19} strokeWidth={2.75} />
            </div>
          </div>

          <div>
            <h1 className="max-w-[260px] text-4xl font-black leading-[0.95] tracking-tight">
              Find your gym.
            </h1>
            <p className="mt-3 text-sm font-bold text-white/75">
              One membership. Train across Malta.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-3 backdrop-blur-md">
                <p className="text-xl font-black text-white">{loading ? "—" : activeCount}</p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-[.13em] text-white/55">
                  Active gyms
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-3 backdrop-blur-md">
                <p className="text-xl font-black text-orange-300">{loading ? "—" : gyms.length}</p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-[.13em] text-white/55">
                  Locations
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
        <Search className="shrink-0 text-[#ff5a0a]" size={20} />
        <label htmlFor="gym-search" className="sr-only">Search gym or location</label>
        <input id="gym-search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Search gym or location" type="search"
          className="min-w-0 w-full bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-slate-400" />
      </div>

      {loading && (
        <section className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-slate-600" aria-live="polite">
          <RefreshCw size={18} className="animate-spin text-[#ff5a0a]" /> Loading gyms…
        </section>
      )}

      {!loading && filteredGyms.length === 0 && (
        <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 text-center">
          <Dumbbell className="mx-auto text-[#ff5a0a]" size={34} />
          <h2 className="mt-4 text-xl font-black text-zinc-950">No gyms found</h2>
          <p className="mt-2 text-sm text-slate-600">Try searching another location.</p>
        </section>
      )}

      <section className="space-y-5" aria-label="Gym locations">
        {filteredGyms.map((gym) => {
          const openingHours = getOpeningHours(gym);
          const tourUrl = getVirtualTourUrl(gym);
          return (
            <article key={gym.id} className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              <a href={`/gyms/${gym.id}`} aria-label={`View ${gym.name}`} className="relative block">
                <img src={getCoverImage(gym)} alt={gym.name} className="h-44 w-full object-cover" loading="lazy" />
                <span className={`absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-black shadow-sm ${gym.status === "active" ? "text-emerald-700" : "text-slate-600"}`}>
                  {statusLabel(gym.status)}
                </span>
                {gym.logo && <span className="absolute bottom-3 right-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-sm">
                  <img src={gym.logo} alt="" className="h-full w-full object-contain" />
                </span>}
              </a>
              <div className="p-5">
                <h2 className="text-2xl font-black tracking-tight text-zinc-950">{gym.name}</h2>
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
                  <MapPinned className="mt-1 shrink-0 text-[#ff5a0a]" size={16} />
                  {gym.address || gym.city || "BestGymsMalta location"}
                </p>
                {openingHours && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-zinc-50 p-4">
                    <Clock className="mt-0.5 shrink-0 text-slate-500" size={17} />
                    <p className="whitespace-pre-line text-xs font-semibold leading-6 text-slate-600">{openingHours}</p>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a href={`/gyms/${gym.id}`} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-3 py-3 text-xs font-black text-white">
                    View gym <ArrowRight size={16} />
                  </a>
                  <a href={getMapsUrl(gym)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-3 text-xs font-bold text-zinc-900">
                    <Navigation size={16} /> Directions
                  </a>
                </div>
                {tourUrl && <a href={`/gyms/${gym.id}/tour`} className="mt-3 flex items-center justify-center gap-2 rounded-full bg-orange-50 px-3 py-3 text-xs font-bold text-[#c2410c]">
                  <Box size={17} /> Explore in 3D
                </a>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
