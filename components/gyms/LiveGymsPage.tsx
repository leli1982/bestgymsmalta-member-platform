"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock,
  Dumbbell,
  MapPinned,
  Navigation,
  RefreshCw,
  Search,
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
      <section
        className="relative min-h-[360px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.78)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/gyms.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/85" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[310px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                BGM Locations
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/35 text-[#fcb415] backdrop-blur-md">
              <MapPinned size={24} strokeWidth={3} />
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Train across the BGM network
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Find your gym, check the details and open directions instantly.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <p className="text-3xl font-black text-white">{activeCount}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-white/45">
                  Active gyms
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <p className="text-3xl font-black text-[#fcb415]">
                  {gyms.length}
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-white/45">
                  Total locations
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
          <Search className="text-[#fcb415]" size={20} strokeWidth={3} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search gym or location"
            className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/30"
          />
        </div>
      </section>

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3 text-white/45">
            <RefreshCw size={18} className="animate-spin" />
            <p className="text-sm font-bold">Loading gyms…</p>
          </div>
        </section>
      ) : null}

      {!loading && filteredGyms.length === 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <Dumbbell className="mx-auto text-[#fcb415]" size={34} strokeWidth={3} />
          <h2 className="mt-4 text-2xl font-black text-white">
            No gyms found
          </h2>
          <p className="mt-2 text-sm font-bold text-white/45">
            Try searching another location.
          </p>
        </section>
      ) : null}

      <section className="space-y-5">
        {filteredGyms.map((gym) => {
          const openingHours = getOpeningHours(gym);

          return (
            <article
              key={gym.id}
              className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.04] shadow-2xl"
            >
              <div
                className="relative min-h-[260px] bg-cover bg-center p-5"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.14), rgba(0,0,0,.78)), url('${getCoverImage(
                    gym
                  )}')`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/85" />

                <div className="relative flex min-h-[220px] flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] ${
                        gym.status === "active"
                          ? "bg-[#fcb415] text-black"
                          : "border border-white/10 bg-black/45 text-white/70"
                      }`}
                    >
                      {statusLabel(gym.status)}
                    </span>

                    {gym.logo ? (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/45 p-2 backdrop-blur-md">
                        <img
                          src={gym.logo}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h2 className="text-4xl font-black leading-tight text-white drop-shadow">
                      {gym.name}
                    </h2>

                    <p className="mt-3 flex items-start gap-2 text-sm font-bold leading-6 text-white/65">
                      <MapPinned
                        className="mt-0.5 shrink-0 text-[#fcb415]"
                        size={17}
                        strokeWidth={3}
                      />
                      {gym.address || gym.city || "BestGymsMalta location"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {openingHours ? (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start gap-3">
                      <Clock
                        className="mt-0.5 shrink-0 text-[#fcb415]"
                        size={18}
                        strokeWidth={3}
                      />
                      <p className="whitespace-pre-line text-sm font-bold leading-6 text-white/55">
                        {openingHours}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={`/gyms/${gym.id}`}
                    className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
                  >
                    View Details
                    <ArrowRight size={17} strokeWidth={3} />
                  </a>

                  <a
                    href={getMapsUrl(gym)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
                  >
                    <Navigation size={17} strokeWidth={3} />
                    Directions
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
