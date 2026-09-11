"use client";

import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPinned, Navigation, RefreshCw, Route } from "lucide-react";

type Gym = {
  id: string;
  name: string;
  status?: string;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  logo?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

type ClosestGym = Gym & {
  distanceKm: number;
};

const LOCATION_STORAGE_KEY = "bgmLastLocation";

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

function getMapsUrl(gym: Gym) {
  if (typeof gym.latitude === "number" && typeof gym.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.latitude},${gym.longitude}`)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.name} ${gym.address || ""}`)}`;
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
      // Ignore saved location errors
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
        setStatus("Closest gym found.");
        setFindingLocation(false);
      },
      () => {
        setStatus("Location permission was not allowed. Enable location access to find your closest gym.");
        setFindingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000 * 60 * 5,
      }
    );
  }

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-orange-600">Closest Gym</p>
          <h2 className="mt-1 text-2xl font-black">{closestGym ? closestGym.name : "Find your nearest BGM gym"}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">
            {closestGym
              ? closestGym.address || closestGym.city || "BGM gym location"
              : "Use your location to find the nearest active BestGymsMalta gym."}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
          <LocateFixed size={24} strokeWidth={3} />
        </div>
      </div>

      {loadingGyms ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 text-zinc-500">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading gyms…</p>
        </div>
      ) : null}

      {closestGym ? (
        <div className="mt-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {closestGym.logo ? (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                  <img src={closestGym.logo} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                  <MapPinned size={24} strokeWidth={3} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">Nearest to you</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-zinc-500">
                  <Route size={16} className="text-orange-500" strokeWidth={3} />
                  {closestGym.distanceKm.toFixed(1)} km away
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={getMapsUrl(closestGym)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-black text-white"
            >
              <Navigation size={17} strokeWidth={3} />
              Directions
            </a>
            <a
              href={`/gyms/${closestGym.id}`}
              className="flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700"
            >
              Gym Details
            </a>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={findClosestGym}
        disabled={findingLocation || loadingGyms}
        className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black disabled:opacity-40 ${
          closestGym
            ? "mt-3 border border-zinc-200 bg-white text-zinc-600"
            : "mt-4 bg-orange-500 text-white"
        }`}
      >
        {findingLocation ? (
          <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
        ) : (
          <LocateFixed size={17} strokeWidth={3} />
        )}
        {closestGym ? "Refresh My Location" : "Find Closest Gym"}
      </button>

      {status ? <p className="mt-3 text-center text-xs font-bold leading-5 text-zinc-400">{status}</p> : null}
    </section>
  );
}
