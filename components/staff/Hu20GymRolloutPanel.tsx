"use client";

import { useCallback, useEffect, useState } from "react";
type Gym = { id: string; name: string; status: string; hu20_punch_clock_enabled: boolean };
export default function Hu20GymRolloutPanel() {
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/system/staff-hu20/gym-rollout", { cache: "no-store" });
    if (response.status === 404) return; // Hidden outside isolated TEST.
    const body = await response.json();
    if (!response.ok || body.ok !== true) throw new Error(body.error || "Could not load rollout switches.");
    setGyms(body.gyms || []);
  }, []);
  useEffect(() => { void load().catch(e=>setError(e instanceof Error ? e.message : "Could not load rollout.")); }, [load]);
  async function toggle(gym: Gym) {
    const enabled = !gym.hu20_punch_clock_enabled;
    if (!window.confirm((enabled ? "ENABLE" : "DISABLE") + " TEST Punch Clock for " + gym.name +
      "? This affects only this gym's Staff Portal and registered fingerprint terminals. " +
      (enabled ? "Only fictional TEST attendance is allowed." : "In-progress new punches will be blocked."))) return;
    setBusy(gym.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/system/staff-hu20/gym-rollout", {
        method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: gym.id, enabled }),
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true || body.punchClockEnabled !== enabled) {
        throw new Error(body.error || "Rollout change unconfirmed.");
      }
      await load();
      setNotice(gym.name + ": TEST Punch Clock " + (enabled ? "enabled" : "disabled") + ".");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rollout change failed.");
      await load().catch(() => {});
    } finally { setBusy(null); }
  }
  if (gyms === null && !error) return null;
  return <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm" aria-label="HU20 Punch Clock gym rollout TEST">
    <h2 className="text-xl font-black">Punch Clock rollout — TEST only</h2>
    <p className="mt-1 text-sm text-zinc-600">
      Enable each gym's Staff Portal and HU20 attendance individually. All gyms start OFF.
      Disabled gyms cannot start a kiosk or record new fingerprint punches, even from an already-open terminal.
      Membership scanning, reception, Bar and Sundries are unaffected.
    </p>
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    {notice && <p className="mt-3 text-sm text-emerald-700" role="status">{notice}</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {(gyms || []).map(gym => <div key={gym.id} className="rounded-xl border border-zinc-200 p-3">
        <div className="font-bold">{gym.name}</div>
        <p className="text-xs text-zinc-600">Gym: {gym.status} · TEST Punch Clock: {gym.hu20_punch_clock_enabled ? "ON" : "OFF"}</p>
        <button type="button" disabled={busy !== null || (gym.status !== "active" && !gym.hu20_punch_clock_enabled)}
          onClick={() => void toggle(gym)}
          className="mt-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-bold disabled:opacity-40">
          {busy === gym.id ? "Saving…" : gym.hu20_punch_clock_enabled ? "Disable Punch Clock" : "Enable Punch Clock"}
        </button>
      </div>)}
    </div>
  </section>;
}
