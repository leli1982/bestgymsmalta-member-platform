"use client";

import { useEffect, useState } from "react";
import { MapPinned, RefreshCw, Save, Upload } from "lucide-react";

type AdminGym = {
  id: string;
  name: string;
  shortName: string;
  status: "active" | "coming_soon";
  city: string;
  address: string;
  latitude: number | "";
  longitude: number | "";
  openingHours: string;
  phone: string;
  email: string;
  logo: string;
  accentColor: string;
  qrCodeId: string;
  facilities: string[];
  classes: string[];
  featuredEquipment: string[];
  notes: string;
  sortOrder: number;
};

export default function GymAdminPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [gyms, setGyms] = useState<AdminGym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [form, setForm] = useState<AdminGym | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedPin = window.sessionStorage.getItem("bgmAdminPin");

    if (savedPin) {
      setPin(savedPin);
      setUnlocked(true);
      loadGyms(savedPin);
    }
  }, []);

  async function adminFetch(options?: RequestInit, overridePin?: string) {
    const activePin = overridePin || pin;

    return fetch("/api/admin/gyms", {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-pin": activePin,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });
  }

  async function unlockAdmin() {
    setStatus("Checking PIN…");

    const response = await adminFetch(undefined, pin);

    if (!response.ok) {
      setStatus("Incorrect PIN or gym admin API not ready.");
      return;
    }

    window.sessionStorage.setItem("bgmAdminPin", pin);
    setUnlocked(true);
    setStatus("Gym admin unlocked.");
    loadGyms(pin);
  }

  async function loadGyms(activePin = pin) {
    const response = await adminFetch(undefined, activePin);
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not load gyms.");
      return;
    }

    setGyms(data.gyms || []);

    if (data.gyms?.length && !form) {
      setSelectedGymId(data.gyms[0].id);
      setForm(data.gyms[0]);
    }
  }

  async function seedGyms() {
    const confirmed = window.confirm(
      "Import the current app gym list into Supabase? This will overwrite matching gym IDs."
    );

    if (!confirmed) return;

    setStatus("Importing gyms…");

    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "seed",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not import gyms.");
      return;
    }

    setStatus("Gyms imported.");
    loadGyms();
  }

  function selectGym(id: string) {
    const gym = gyms.find((item) => item.id === id);
    if (!gym) return;

    setSelectedGymId(id);
    setForm(gym);
  }

  function updateForm(updates: Partial<AdminGym>) {
    setForm((current) => (current ? { ...current, ...updates } : current));
  }

  function textToList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function saveGym() {
    if (!form) return;

    setStatus("Saving gym…");

    const response = await adminFetch({
      method: "POST",
      body: JSON.stringify({
        mode: "update",
        gym: form,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Could not save gym.");
      return;
    }

    setStatus("Gym saved.");
    await loadGyms();
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-black p-5 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            BGM Gym Admin
          </p>

          <h1 className="mt-3 text-3xl font-black">Gym details admin</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Enter your private admin PIN to manage gym locations, hours,
            facilities and map pins.
          </p>

          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Admin PIN"
            className="mt-5 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={unlockAdmin}
            className="mt-4 w-full rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            Unlock Gym Admin
          </button>

          {status ? (
            <p className="mt-4 text-sm font-bold text-white/50">{status}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-5 pb-28 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 to-black p-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            BGM Gym Admin
          </p>

          <h1 className="mt-3 text-4xl font-black">Gym details</h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Edit opening hours, status, phone numbers, facilities and map pins.
            Changes appear in the app without redeploying.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => loadGyms()}
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black"
            >
              <RefreshCw size={16} strokeWidth={3} />
              Refresh
            </button>

            <button
              type="button"
              onClick={seedGyms}
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
            >
              <Upload size={16} strokeWidth={3} />
              Import Gyms
            </button>
          </div>
        </section>

        {gyms.length === 0 ? (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-bold leading-6 text-white/50">
              No gyms found in Supabase yet. Tap <strong>Import Gyms</strong> to
              copy the current app gym list into Supabase.
            </p>
          </section>
        ) : null}

        {gyms.length > 0 && form ? (
          <>
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[.18em] text-white/40">
                  Select Gym
                </span>

                <select
                  value={selectedGymId}
                  onChange={(event) => selectGym(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
                >
                  {gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <MapPinned className="text-orange-500" size={26} strokeWidth={3} />
                <h2 className="text-2xl font-black">{form.name}</h2>
              </div>

              <div className="grid gap-3">
                <input
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  placeholder="Gym name"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <input
                  value={form.shortName}
                  onChange={(event) =>
                    updateForm({ shortName: event.target.value })
                  }
                  placeholder="Short name"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm({
                      status: event.target.value as "active" | "coming_soon",
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                >
                  <option value="active">Active</option>
                  <option value="coming_soon">Coming Soon</option>
                </select>

                <input
                  value={form.city}
                  onChange={(event) => updateForm({ city: event.target.value })}
                  placeholder="City"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <textarea
                  value={form.address}
                  onChange={(event) =>
                    updateForm({ address: event.target.value })
                  }
                  placeholder="Address"
                  className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <textarea
                  value={form.openingHours}
                  onChange={(event) =>
                    updateForm({ openingHours: event.target.value })
                  }
                  placeholder="Opening hours"
                  className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.latitude}
                    onChange={(event) =>
                      updateForm({
                        latitude:
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                      })
                    }
                    placeholder="Latitude"
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                  />

                  <input
                    value={form.longitude}
                    onChange={(event) =>
                      updateForm({
                        longitude:
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                      })
                    }
                    placeholder="Longitude"
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateForm({ phone: event.target.value })
                    }
                    placeholder="Phone"
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                  />

                  <input
                    value={form.email}
                    onChange={(event) =>
                      updateForm({ email: event.target.value })
                    }
                    placeholder="Email"
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                  />
                </div>

                <input
                  value={form.logo}
                  onChange={(event) => updateForm({ logo: event.target.value })}
                  placeholder="Logo path, example /gym-logos/bgm-marsa.png"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <input
                  value={form.facilities.join(", ")}
                  onChange={(event) =>
                    updateForm({ facilities: textToList(event.target.value) })
                  }
                  placeholder="Facilities, comma separated"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <input
                  value={form.classes.join(", ")}
                  onChange={(event) =>
                    updateForm({ classes: textToList(event.target.value) })
                  }
                  placeholder="Classes, comma separated"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <input
                  value={form.featuredEquipment.join(", ")}
                  onChange={(event) =>
                    updateForm({
                      featuredEquipment: textToList(event.target.value),
                    })
                  }
                  placeholder="Featured equipment, comma separated"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm({ notes: event.target.value })}
                  placeholder="Notes"
                  className="min-h-28 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    updateForm({ sortOrder: Number(event.target.value) })
                  }
                  placeholder="Sort order"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold outline-none"
                />

                <button
                  type="button"
                  onClick={saveGym}
                  className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
                >
                  <Save size={17} strokeWidth={3} />
                  Save Gym
                </button>
              </div>
            </section>
          </>
        ) : null}

        {status ? (
          <p className="text-center text-sm font-bold text-white/50">
            {status}
          </p>
        ) : null}
      </div>
    </main>
  );
}
