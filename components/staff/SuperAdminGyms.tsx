"use client";

import { useEffect, useMemo, useState } from "react";
import { buildGymProvisioningIdentity } from "@/lib/gymProvisioningCore";

type Status = "active" | "inactive" | "coming_soon";
type Gym = {
  id: string; name: string; shortName: string; status: Status;
  city: string; address: string; openingHours: string; phone: string; email: string;
  latitude: number | ""; longitude: number | "";
  logo: string; virtualTourUrl: string; accentColor: string;
  facilities: string[]; classes: string[]; featuredEquipment: string[]; notes: string;
  sortOrder: number; publicEnrollmentSlug?: string; joinPath?: string | null;
  staffPath?: string | null; staffProvisioned?: boolean; staffUsername?: string | null;
  staffActive?: boolean; staffSystemUserId?: string | null;
};
const emptyGym: Gym = {
  id: "", name: "", shortName: "", status: "active", city: "", address: "",
  openingHours: "", phone: "", email: "", latitude: "", longitude: "", logo: "",
  virtualTourUrl: "", accentColor: "#fcb415", facilities: [], classes: [],
  featuredEquipment: [], notes: "", sortOrder: 999,
};
const inputClass = "mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-zinc-950";
function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
export default function SuperAdminGyms() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [form, setForm] = useState<Gym | null>(null);
  const [creating, setCreating] = useState(false);
  const [staffPassword, setStaffPassword] = useState("");
  const [facilities, setFacilities] = useState("");
  const [classes, setClasses] = useState("");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/auth", { cache: "no-store" });
        const payload = await response.json();
        if (!active) return;
        const admin = response.ok && payload.authenticated && Boolean(payload.user?.isSuperAdmin);
        setAllowed(admin);
        if (admin) await loadGyms();
      } catch {
        if (active) setAllowed(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function selectGym(gym: Gym) {
    setCreating(false);
    setForm({ ...gym });
    setFacilities((gym.facilities || []).join(", "));
    setClasses((gym.classes || []).join(", "));
    setEquipment((gym.featuredEquipment || []).join(", "));
    setStaffPassword("");
    setError(""); setMessage("");
  }
  async function loadGyms(preferredId?: string) {
    const response = await fetch("/api/admin/gyms", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load gym locations.");
    const next = (payload.gyms || []) as Gym[];
    setGyms(next);
    if (preferredId) {
      const selected = next.find((gym) => gym.id === preferredId);
      if (selected) selectGym(selected);
    }
  }
  function newGym() {
    setForm({ ...emptyGym, sortOrder: gyms.length + 1 });
    setCreating(true);
    setFacilities(""); setClasses(""); setEquipment(""); setStaffPassword("");
    setError(""); setMessage("");
  }
  function update(changes: Partial<Gym>) {
    setForm((current) => current ? { ...current, ...changes } : current);
  }
  const preview = useMemo(() => {
    if (!form?.name.trim()) return null;
    try {
      return buildGymProvisioningIdentity({ name: form.name, shortName: form.shortName });
    } catch {
      return null;
    }
  }, [form?.name, form?.shortName]);
  const routeSlug = creating ? preview?.routeSlug : form?.publicEnrollmentSlug;
  const joinPath = routeSlug ? "/join/" + routeSlug : "";
  const staffPath = routeSlug ? "/staff/" + routeSlug : "";
  const needsStaffPassword = Boolean(form?.status === "active" && (creating || !form.staffProvisioned));

  async function saveGym(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !form.name.trim() || (creating && !preview)) {
      setError("Enter a valid gym name to create its URLs."); return;
    }
    if (needsStaffPassword && staffPassword.length < 8) {
      setError("Set a staff password of at least 8 characters before activating this gym."); return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/gyms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: creating ? "create" : "update",
          gym: {
            ...form, facilities: splitList(facilities), classes: splitList(classes),
            featuredEquipment: splitList(equipment),
          },
          staffPassword: needsStaffPassword ? staffPassword : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save gym.");
      setStaffPassword("");
      await loadGyms(payload.gym?.id || form.id);
      setMessage("Gym saved. Tablet: " + (payload.joinPath || joinPath) + " · Staff: " + (payload.staffPath || staffPath));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save gym.");
    } finally {
      setSaving(false);
    }
  }
  async function toggleActive(gym: Gym) {
    if (saving) return;
    if (gym.status === "active" && !window.confirm("Mark " + gym.name + " inactive? Its staff login and tablet registration will stop working until reactivated.")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/gyms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "update", gym: { ...gym, status: gym.status === "active" ? "inactive" : "active" } }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not change gym status.");
      await loadGyms(gym.id);
      setMessage(gym.name + (gym.status === "active" ? " is now inactive." : " is now active."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change gym status.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteGym() {
    if (!form?.id || saving) return;
    if (form.status === "active") {
      setError("Mark the gym inactive before removing it."); return;
    }
    if (!window.confirm("Permanently delete " + form.name + "? Only gyms without staff accounts or linked records can be deleted. Existing membership records must be preserved.")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/gyms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "delete", id: form.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "This gym cannot be deleted while staff or membership records exist. Keep it inactive instead.");
      setForm(null); setCreating(false);
      await loadGyms();
      setMessage("Gym deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete gym.");
    } finally {
      setSaving(false);
    }
  }
  async function resetStaffPassword() {
    if (!form?.staffSystemUserId || staffPassword.length < 8 || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/system-users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.staffSystemUserId, password: staffPassword }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not reset staff password.");
      setStaffPassword("");
      setMessage("Staff password reset for " + form.name + ".");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset staff password.");
    } finally {
      setSaving(false);
    }
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/admin/gym-logo-upload", { method: "POST", body: data });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not upload gym logo.");
      update({ logo: payload.logoUrl });
      setMessage("Logo uploaded. Save this gym to keep the change.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (allowed === null) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Checking Super Admin access…</main>;
  if (!allowed) return <main className="min-h-screen bg-zinc-50 p-8 text-zinc-900">Super Admin access required. <a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href="/staff/admin" className="font-bold text-orange-700">← Super Admin</a>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-3xl font-black">Gym locations</h1><p className="mt-1 text-sm text-zinc-600">Add, edit, activate or deactivate gyms. Staff and tablet links are generated automatically from each new gym's name.</p></div>
            <button type="button" onClick={newGym} className="rounded-xl bg-[#ff5a0a] px-5 py-3 font-black text-white">+ Add new gym</button>
          </div>
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(250px,1fr)_minmax(0,2fr)]">
          <section className="space-y-2 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Gym locations list">
            <h2 className="px-2 text-lg font-black">All gym locations ({gyms.length})</h2>
            {gyms.map((gym) => (
              <div key={gym.id} className={form?.id === gym.id && !creating ? "rounded-xl border-2 border-orange-400 bg-orange-50 p-3" : "rounded-xl border border-zinc-200 p-3"}>
                <button type="button" onClick={() => selectGym(gym)} className="w-full text-left">
                  <span className="block font-black">{gym.name}</span>
                  <span className={gym.status === "active" ? "mt-1 inline-block text-xs font-black text-emerald-700" : "mt-1 inline-block text-xs font-black text-zinc-600"}>{gym.status === "active" ? "ACTIVE" : gym.status === "inactive" ? "INACTIVE" : "COMING SOON"}</span>
                  {gym.staffPath && <span className="mt-1 block break-all text-xs text-zinc-500">{gym.staffPath}</span>}
                </button>
                <button type="button" disabled={saving} onClick={() => void toggleActive(gym)} className="mt-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-orange-700 disabled:opacity-40">{gym.status === "active" ? "Mark inactive" : "Activate"}</button>
              </div>
            ))}
          </section>
          {!form ? <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-zinc-600">Select a gym to edit its details or choose Add new gym.</section> : (
            <form onSubmit={(event) => void saveGym(event)} className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">{creating ? "Add a new gym" : "Edit " + form.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Gym name
                  <input aria-label="Gym name" required value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="Naxxar" className={inputClass}/>
                </label>
                <label className="text-sm font-bold">Short display name
                  <input aria-label="Gym short name" value={form.shortName} onChange={(event) => update({ shortName: event.target.value })} placeholder="Naxxar" className={inputClass}/>
                </label>
                <label className="text-sm font-bold">Status
                  <select aria-label="Gym status" value={form.status} onChange={(event) => update({ status: event.target.value as Status })} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="coming_soon">Coming soon</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Sort order
                  <input aria-label="Gym sort order" type="number" value={form.sortOrder} onChange={(event) => update({ sortOrder: Number(event.target.value) })} className={inputClass}/>
                </label>
              </div>
              <section aria-label="Generated gym addresses" className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <h3 className="text-lg font-black text-zinc-950">Automatically generated addresses</h3>
                <p className="text-xs text-zinc-600">New gym URLs are based on the gym name and remain stable after creation. Inactive and coming-soon gyms keep reserved URLs but cannot accept staff logins or tablet registrations until activated.</p>
                <div><p className="text-sm font-black">Staff Portal address</p>{staffPath ? <a className="break-all text-sm font-bold text-orange-700 underline" href={form.status === "active" && !creating ? staffPath : undefined}>{origin + staffPath}</a> : <p className="text-sm text-zinc-500">Enter a gym name</p>}</div>
                <div><p className="text-sm font-black">Tablet membership address</p>{joinPath ? <a className="break-all text-sm font-bold text-orange-700 underline" href={form.status === "active" && !creating ? joinPath : undefined}>{origin + joinPath}</a> : <p className="text-sm text-zinc-500">Enter a gym name</p>}</div>
                {!creating && <p className="text-xs font-semibold text-zinc-600">Staff username: {form.staffUsername || "Not assigned"} · {form.staffProvisioned ? form.staffActive ? "Active" : "Disabled" : "Not provisioned"}</p>}
              </section>
              {(needsStaffPassword || Boolean(form.staffSystemUserId)) && (
                <section aria-label="Gym Staff password" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="font-black">{needsStaffPassword ? "Assign Staff Portal password" : "Reset Staff Portal password"}</h3>
                  <p className="mt-1 text-xs text-zinc-600">Passwords cannot be viewed. Set at least 8 characters; existing passwords can be reset without changing the gym's URL.</p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-48 flex-1 text-sm font-bold">Staff password
                      <input aria-label="Gym Staff password" autoComplete="new-password" type="password" minLength={8} required={needsStaffPassword} value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} placeholder="At least 8 characters" className={inputClass}/>
                    </label>
                    {!needsStaffPassword && <button type="button" disabled={saving || staffPassword.length < 8} onClick={() => void resetStaffPassword()} className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Reset staff password</button>}
                  </div>
                  {!creating && form.staffProvisioned && <a href={"/staff/admin/staff-logins?gymId=" + encodeURIComponent(form.id)} className="mt-2 inline-block text-sm font-bold text-orange-700 underline">Edit this gym's staff username and access</a>}
                </section>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">City<input aria-label="Gym city" value={form.city} onChange={(event) => update({ city: event.target.value })} className={inputClass}/></label>
                <label className="text-sm font-bold">Phone<input aria-label="Gym phone" value={form.phone} onChange={(event) => update({ phone: event.target.value })} className={inputClass}/></label>
                <label className="text-sm font-bold">Email<input aria-label="Gym email" type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} className={inputClass}/></label>
                <label className="text-sm font-bold">Accent colour<input aria-label="Gym accent colour" value={form.accentColor} onChange={(event) => update({ accentColor: event.target.value })} className={inputClass}/></label>
                <label className="text-sm font-bold">Latitude<input aria-label="Gym latitude" type="number" step="any" value={form.latitude} onChange={(event) => update({ latitude: event.target.value === "" ? "" : Number(event.target.value) })} className={inputClass}/></label>
                <label className="text-sm font-bold">Longitude<input aria-label="Gym longitude" type="number" step="any" value={form.longitude} onChange={(event) => update({ longitude: event.target.value === "" ? "" : Number(event.target.value) })} className={inputClass}/></label>
              </div>
              <label className="block text-sm font-bold">Address<textarea aria-label="Gym address" value={form.address} onChange={(event) => update({ address: event.target.value })} rows={2} className={inputClass}/></label>
              <label className="block text-sm font-bold">Opening hours<textarea aria-label="Gym opening hours" value={form.openingHours} onChange={(event) => update({ openingHours: event.target.value })} rows={3} placeholder="Monday–Friday: 06:00–22:00..." className={inputClass}/></label>
              <label className="block text-sm font-bold">Virtual tour URL<input aria-label="Gym virtual tour URL" value={form.virtualTourUrl} onChange={(event) => update({ virtualTourUrl: event.target.value })} placeholder="https://..." className={inputClass}/></label>
              <label className="block text-sm font-bold">Logo URL<input aria-label="Gym logo URL" value={form.logo} onChange={(event) => update({ logo: event.target.value })} placeholder="https://..." className={inputClass}/></label>
              <label className="block text-sm font-bold">Upload logo
                <input aria-label="Upload gym logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void uploadLogo(event.target.files?.[0])} className="mt-1 block w-full text-sm"/>
              </label>
              <label className="block text-sm font-bold">Facilities (comma separated)<textarea aria-label="Gym facilities" value={facilities} onChange={(event) => setFacilities(event.target.value)} rows={2} className={inputClass}/></label>
              <label className="block text-sm font-bold">Classes (comma separated)<textarea aria-label="Gym classes" value={classes} onChange={(event) => setClasses(event.target.value)} rows={2} className={inputClass}/></label>
              <label className="block text-sm font-bold">Featured equipment (comma separated)<textarea aria-label="Gym featured equipment" value={equipment} onChange={(event) => setEquipment(event.target.value)} rows={2} className={inputClass}/></label>
              <label className="block text-sm font-bold">Notes<textarea aria-label="Gym notes" value={form.notes} onChange={(event) => update({ notes: event.target.value })} rows={2} className={inputClass}/></label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={saving || uploading || !form.name.trim() || (creating && !preview)} className="rounded-xl bg-[#ff5a0a] px-6 py-3 font-black text-white disabled:opacity-40">{saving ? "Saving…" : creating ? "Add gym and create addresses" : "Save gym details"}</button>
                {!creating && form.status !== "active" && <button type="button" disabled={saving} onClick={() => void deleteGym()} className="rounded-xl border border-red-300 bg-red-50 px-5 py-3 font-black text-red-700 disabled:opacity-40">Permanently delete unlinked gym</button>}
              </div>
              <p className="text-xs text-zinc-500">For a gym with staff or historical member data, mark it inactive instead of deleting it. This preserves records and disables its staff and tablet access.</p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
