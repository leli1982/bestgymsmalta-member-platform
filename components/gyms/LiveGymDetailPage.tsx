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
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading gym…</p>
        </div>
      </section>
    );
  }

  if (!gym) {
    return (
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-center">
        <Dumbbell className="mx-auto text-[#c2410c]" size={42} strokeWidth={3} />
        <h1 className="mt-4 text-3xl font-black text-zinc-950">Gym not found</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
          This location could not be found.
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

  const openingHours = getOpeningHours(gym);
  const tourUrl = getVirtualTourUrl(gym);


  return (
    <div className="space-y-5">
      <a href="/gyms" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">
        <ArrowLeft size={17} /> All gyms
      </a>
      <section className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="relative">
          <img src={getCoverImage(gym)} alt={gym.name} className="h-52 w-full object-cover" />
          <span className={`absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm ${gym.status === "active" ? "text-emerald-700" : "text-slate-600"}`}>{statusLabel(gym.status)}</span>
          {gym.logo && <div className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-sm">
            <img src={gym.logo} alt="" className="h-full w-full object-contain" />
          </div>}
        </div>
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#c2410c]">BestGymsMalta location</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-zinc-950">{gym.name}</h1>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <MapPinned className="mt-1 shrink-0 text-[#ff5a0a]" size={17} />
            {gym.address || gym.city || "BestGymsMalta location"}
          </p>
          <a href={getMapsUrl(gym)} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white">
            <Navigation size={17} /> Get directions
          </a>
        </div>
      </section>

      {tourUrl && (
        <section className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5">
          <div className="flex items-center gap-3">
            <Box size={27} className="shrink-0 text-[#c2410c]" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#c2410c]">Explore before you visit</p>
              <h2 className="mt-1 text-xl font-black text-zinc-950">Step inside in 3D</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">Take a look around {gym.name} and explore the space before your next session.</p>
          <a href={`/gyms/${gym.id}/tour`} className="mt-4 flex items-center justify-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-[#c2410c]">
            <Box size={17} /> Start virtual tour
          </a>
        </section>
      )}

      {openingHours ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 shrink-0 text-[#c2410c]" size={23} strokeWidth={3} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#c2410c]">
                Opening Hours
              </p>
              <p className="mt-3 whitespace-pre-line text-sm font-bold leading-6 text-slate-600">
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
            className="rounded-[1.5rem] border border-zinc-200 bg-white p-4"
          >
            <Phone className="text-[#c2410c]" size={23} strokeWidth={3} />
            <p className="mt-3 text-xs font-black uppercase tracking-[.18em] text-slate-500">
              Phone
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-950">{gym.phone}</p>
          </a>
        ) : null}

        {gym.email ? (
          <a
            href={`mailto:${gym.email}`}
            className="rounded-[1.5rem] border border-zinc-200 bg-white p-4"
          >
            <Mail className="text-[#c2410c]" size={23} strokeWidth={3} />
            <p className="mt-3 text-xs font-black uppercase tracking-[.18em] text-slate-500">
              Email
            </p>
            <p className="mt-1 truncate text-sm font-bold text-zinc-950">
              {gym.email}
            </p>
          </a>
        ) : null}
      </section>

      {facilities.length > 0 ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#c2410c]">
            Facilities
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {facilities.map((facility) => (
              <span
                key={facility}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-black text-slate-600"
              >
                {facility}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {classes.length > 0 ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#c2410c]">
            Classes
          </p>
          <div className="mt-4 grid gap-2">
            {classes.map((gymClass) => (
              <div
                key={gymClass}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <p className="text-sm font-black text-zinc-950">{gymClass}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {equipment.length > 0 ? (
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#c2410c]">
            Featured Equipment
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {equipment.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <Sparkles className="text-[#c2410c]" size={18} strokeWidth={3} />
                <p className="mt-3 text-sm font-black text-zinc-950">{item}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {gym.notes ? (
        <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#c2410c]">
            Notes
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            {gym.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
