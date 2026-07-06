"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  Mail,
  MapPinned,
  Navigation,
  Phone,
  RefreshCw,
  Sparkles,
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
  notes?: string;
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

function getFeaturedEquipment(gym: Gym) {
  return gym.featuredEquipment || gym.featured_equipment || [];
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

export default function LiveGymDetailPage(props: {
  gymId?: string;
  id?: string;
}) {
  const gymId = props.gymId || props.id || "";
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

  const facilities = useMemo(() => gym?.facilities || [], [gym]);
  const classes = useMemo(() => gym?.classes || [], [gym]);
  const equipment = useMemo(() => (gym ? getFeaturedEquipment(gym) : []), [gym]);

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading gym…</p>
        </div>
      </section>
    );
  }

  if (!gym) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
        <Dumbbell className="mx-auto text-[#fcb415]" size={42} strokeWidth={3} />
        <h1 className="mt-4 text-3xl font-black text-white">Gym not found</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          This location could not be found.
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

  const openingHours = getOpeningHours(gym);
  const tourUrl = getVirtualTourUrl(gym);

  return (
    <div className="space-y-6">
      <a
        href="/gyms"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white"
      >
        <ArrowLeft size={17} strokeWidth={3} />
        Back to Gyms
      </a>

      <section
        className="relative min-h-[430px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.18), rgba(0,0,0,.78)), url('${getCoverImage(
            gym
          )}')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/88" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[380px] flex-col justify-between">
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
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-black/45 p-3 backdrop-blur-md">
                <img src={gym.logo} alt="" className="h-full w-full object-contain" />
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[.24em] text-[#fcb415]">
              BestGymsMalta Location
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              {gym.name}
            </h1>

            <p className="mt-5 flex items-start gap-2 text-sm font-bold leading-6 text-white/70">
              <MapPinned
                className="mt-0.5 shrink-0 text-[#fcb415]"
                size={17}
                strokeWidth={3}
              />
              {gym.address || gym.city || "BestGymsMalta location"}
            </p>

            <div className="mt-6 grid gap-3">
              <a
                href={getMapsUrl(gym)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
              >
                <Navigation size={17} strokeWidth={3} />
                Open Directions
              </a>

              {tourUrl ? (
                <a
                  href={tourUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-black text-white backdrop-blur-md"
                >
                  <Box size={18} strokeWidth={3} />
                  Start 3D Virtual Tour
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {openingHours ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 shrink-0 text-[#fcb415]" size={23} strokeWidth={3} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Opening Hours
              </p>
              <p className="mt-3 whitespace-pre-line text-sm font-bold leading-6 text-white/60">
                {openingHours}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        {gym.phone ? (
          <a
            href={`tel:${gym.phone}`}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
          >
            <Phone className="text-[#fcb415]" size={23} strokeWidth={3} />
            <p className="mt-3 text-xs font-black uppercase tracking-[.18em] text-white/35">
              Phone
            </p>
            <p className="mt-1 text-sm font-bold text-white">{gym.phone}</p>
          </a>
        ) : null}

        {gym.email ? (
          <a
            href={`mailto:${gym.email}`}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4"
          >
            <Mail className="text-[#fcb415]" size={23} strokeWidth={3} />
            <p className="mt-3 text-xs font-black uppercase tracking-[.18em] text-white/35">
              Email
            </p>
            <p className="mt-1 truncate text-sm font-bold text-white">
              {gym.email}
            </p>
          </a>
        ) : null}
      </section>

      {facilities.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Facilities
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {facilities.map((facility) => (
              <span
                key={facility}
                className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-white/65"
              >
                {facility}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {classes.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Classes
          </p>
          <div className="mt-4 grid gap-2">
            {classes.map((gymClass) => (
              <div
                key={gymClass}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <p className="text-sm font-black text-white">{gymClass}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {equipment.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Featured Equipment
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {equipment.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <Sparkles className="text-[#fcb415]" size={18} strokeWidth={3} />
                <p className="mt-3 text-sm font-black text-white">{item}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {gym.notes ? (
        <section className="rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Notes
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-white/65">
            {gym.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
