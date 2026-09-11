"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LocateFixed, MapPinned, RefreshCw } from "lucide-react";

type Gym = {
  id: string;
  name: string;
  status?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  logo?: string;
  coverImage?: string;
  cover_image?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

type ClosestGym = Gym & {
  distanceKm: number;
};

const LOCATION_STORAGE_KEY = "bgmLastLocation";

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
  return gym.coverImage || gym.cover_image || gymCoverImages[gym.id] || "/visuals/gyms.jpg";
}

function getDistanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export default function ClosestGymCard() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loadingGyms, setLoadingGyms] = useState(true);
  const [findingLocation, setFindingLocation] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadGyms() {
      try {
        const response = await fetch("/api/gyms", { cache: "no-store" });
        const data = await response.json();
        setGyms(data.gyms || []);
      } catch {
        setGyms([]);
      } finally {
        setLoadingGyms(false);
      }
    }

    loadGyms();

    try {
      const saved = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) setLocation(JSON.parse(saved));
    } catch {
      // Ignore saved location errors.
    }
  }, []);

  const closestGym: ClosestGym | null = useMemo(() => {
    if (!location) return null;

    const activeGymsWithLocation = gyms.filter(
      (gym) =>
        gym.status === "active" &&
        typeof gym.latitude === "number" &&
        typeof gym.longitude === "number"
    );

    if (activeGymsWithLocation.length === 0) return null;

    return activeGymsWithLocation
      .map((gym) => ({
        ...gym,
        distanceKm: getDistanceKm(
          location.latitude,
          location.longitude,
          gym.latitude as number,
          gym.longitude as number
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  }, [gyms, location]);

  function findClosestGym() {
    if (!navigator.geolocation) {
      setStatus("Location is not supported on this device/browser.");
      return;
    }

    setFindingLocation(true);
    setStatus("Finding your closest BGM gym…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(nextLocation);
        window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(nextLocation));
        setStatus("");
        setFindingLocation(false);
      },
      () => {
        setStatus("Enable location access to find your closest gym.");
        setFindingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000 * 60 * 5,
      }
    );
  }

  if (loadingGyms) {
    return (
      <section
        data-home-nearest="compact-row"
        className="flex min-h-[104px] items-center justify-center rounded-[1.45rem] border border-zinc-200/80 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
      >
        <RefreshCw size={18} className="animate-spin text-[#ff5a0a]" />
        <span className="ml-2 text-xs font-bold text-slate-500">Loading nearest gym…</span>
      </section>
    );
  }

  if (!closestGym) {
    return (
      <section
        data-home-nearest="compact-row"
        className="rounded-[1.45rem] border border-zinc-200/80 bg-white p-3 shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
      >
        <button
          type="button"
          onClick={findClosestGym}
          disabled={findingLocation}
          className="flex w-full items-center gap-3 text-left disabled:opacity-50"
        >
          <span className="flex h-[72px] w-[92px] shrink-0 items-center justify-center rounded-[1rem] bg-zinc-950 text-[#ff5a0a]">
            {findingLocation ? <RefreshCw size={24} className="animate-spin" /> : <LocateFixed size={25} strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-slate-500">Nearest Gym</span>
            <span className="mt-0.5 block text-[15px] font-black text-zinc-950">Find your closest BGM gym</span>
            <span className="mt-1 block text-[10px] font-semibold text-slate-400">Tap to use your location</span>
          </span>
          <ChevronRight className="shrink-0 text-slate-400" size={21} strokeWidth={3} />
        </button>
        {status ? <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">{status}</p> : null}
      </section>
    );
  }

  return (
    <section
      data-home-nearest="compact-row"
      className="rounded-[1.45rem] border border-zinc-200/80 bg-white p-3 shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center gap-3">
        <a href={`/gyms/${closestGym.id}`} className="h-[72px] w-[104px] shrink-0 overflow-hidden rounded-[1rem] bg-zinc-900">
          <img src={getCoverImage(closestGym)} alt="" className="h-full w-full object-cover" />
        </a>

        <a href={`/gyms/${closestGym.id}`} className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-slate-500">Nearest Gym</span>
          <span className="mt-0.5 block truncate text-[16px] font-black text-zinc-950">{closestGym.name}</span>
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <MapPinned size={13} className="text-slate-400" strokeWidth={3} />
            {closestGym.distanceKm.toFixed(1)} km away
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-700 min-[390px]:inline-flex">
            Active
          </span>
          <a href={`/gyms/${closestGym.id}`} aria-label={`Open ${closestGym.name}`} className="text-slate-400">
            <ChevronRight size={22} strokeWidth={3} />
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={findClosestGym}
        disabled={findingLocation}
        className="mt-2 flex w-full items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 disabled:opacity-50"
      >
        {findingLocation ? <RefreshCw size={12} className="animate-spin" /> : <LocateFixed size={12} />}
        Refresh my location
      </button>
      {status ? <p className="mt-1 text-center text-[10px] font-semibold text-slate-400">{status}</p> : null}
    </section>
  );
}
