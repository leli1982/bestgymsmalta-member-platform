"use client";

import { useEffect, useMemo, useState } from "react";

type Scope = "all" | "super_admin" | "gym_staff";
type Gym = { id: string; name: string; staffPath?: string | null; status: string };
type SystemUser = {
  id: string;
  gymId: string | null;
  gymName: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  active: boolean;
  permissions: string[];
  lastLoginAt?: string | null;
};
const gymStaffAccess = [
  "New memberships and renewals", "Member photo view and capture",
  "Reception / barcode scanning", "Assign and replace preprinted member cards",
  "Submit sundries orders", "Submit bar lists",
];
function GymStaffAccessSummary() {
  return <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
    <p className="text-sm font-bold text-zinc-900">Gym Staff access</p>
    <p className="mt-1 text-xs leading-5 text-zinc-500">One shared login per gym with a fixed operational role.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {gymStaffAccess.map((item) => <div key={item} className="rounded-lg bg-white px-3 py-2 text-sm text-zinc-700">{item}</div>)}
    </div>
  </div>;
}

export default function SystemUsersAdmin({
  scope = "all", initialGymId = "",
}: { scope?: Scope; initialGymId?: string }) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(scope === "super_admin");
  const [gymId, setGymId] = useState(initialGymId);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [usersResponse, gymsResponse] = await Promise.all([
        fetch("/api/admin/system-users", { cache: "no-store" }),
        fetch("/api/admin/gyms", { cache: "no-store" }),
      ]);
      const usersData = await usersResponse.json().catch(() => ({}));
      if (!usersResponse.ok) throw new Error(usersData.error || "Super Admin login is required.");
      const gymsData = await gymsResponse.json().catch(() => ({}));
      if (!gymsResponse.ok) throw new Error(gymsData.error || "Could not load gym locations.");
      setUsers(usersData.users || []);
      setGyms(gymsData.gyms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load system users.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const availableGyms = useMemo(() => {
    const assigned = new Set(users.filter((user) => user.gymId).map((user) => user.gymId));
    return gyms.filter((gym) => !assigned.has(gym.id));
  }, [users, gyms]);
  const shownUsers = users.filter((user) =>
    (scope === "all" || (scope === "super_admin" ? user.isSuperAdmin : !user.isSuperAdmin))
    && (!initialGymId || user.isSuperAdmin || user.gymId === initialGymId)
  );
  const role = scope === "super_admin" ? true : scope === "gym_staff" ? false : isSuperAdmin;
  const heading = scope === "super_admin" ? "Super Admin accounts"
    : scope === "gym_staff" ? "Staff Portal logins" : "System Users";

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage(""); setError(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/system-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: role ? null : gymId, username, displayName, password, isSuperAdmin: role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create system login.");
      setUsername(""); setDisplayName(""); setPassword(""); setGymId(initialGymId);
      await load();
      setMessage(data.user.displayName + " login created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create system login.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: SystemUser, changes: Record<string, unknown>): Promise<boolean> {
    setMessage(""); setError(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/system-users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ...changes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update system login.");
      await load();
      setMessage(data.user.displayName + " login updated.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update system login.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href={scope === "all" ? "/bgm-admin" : "/staff/admin"} className="font-bold text-orange-700">← {scope === "all" ? "BGM Admin" : "Super Admin"}</a>
          <h1 className="mt-3 text-3xl font-black">{heading}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {scope === "super_admin" ? "Manage individual Super Admin accounts and their access."
              : scope === "gym_staff" ? "Each gym has one shared Staff Portal login. Assign a password or reset an existing one here."
                : "Manage Super Admin and gym staff logins."}
            {" "}Passwords are never displayed; set or reset them instead.
          </p>
          {scope === "gym_staff" && <a href="/staff/admin/gyms" className="mt-3 inline-block text-sm font-bold text-orange-700 underline">Manage gym locations and staff addresses</a>}
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        {scope === "gym_staff" && initialGymId && !availableGyms.some((gym) => gym.id === initialGymId) ?
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-600">This gym already has a Staff Portal login. Edit its username, password or active status in the account below.</p> :
        <form onSubmit={(event) => void createUser(event)} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">{role ? "Add Super Admin login" : "Assign a Staff Portal login"}</h2>
          {scope === "all" && <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setIsSuperAdmin(false)} className={!role ? "rounded-xl bg-orange-600 px-4 py-2 font-bold text-white" : "rounded-xl bg-zinc-100 px-4 py-2 font-bold"}>Gym Staff</button>
            <button type="button" onClick={() => setIsSuperAdmin(true)} className={role ? "rounded-xl bg-orange-600 px-4 py-2 font-bold text-white" : "rounded-xl bg-zinc-100 px-4 py-2 font-bold"}>Super Admin</button>
          </div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {!role && <label className="text-sm font-bold">Gym
              <select aria-label="Gym for staff login" required value={gymId} onChange={(event) => setGymId(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3">
                <option value="">Select gym</option>{availableGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-zinc-500">Gyms with an existing shared staff account are managed below, not created twice.</span>
            </label>}
            <label className="text-sm font-bold">Display name<input aria-label="New login display name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder={role ? "Super Admin" : "Naxxar Staff"}/></label>
            <label className="text-sm font-bold">Username<input aria-label="New login username" required autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder={role ? "adminname" : "naxxarfitness"}/></label>
            <label className="text-sm font-bold">Set password<input aria-label="New login password" required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder="At least 8 characters"/></label>
          </div>
          {!role && <div className="mt-4"><GymStaffAccessSummary/></div>}
          {role && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm font-bold text-orange-800">Super Admin accounts have unrestricted BGM management access. Only assign this role to trusted people.</p>}
          <button type="submit" disabled={saving || loading} className="mt-5 rounded-xl bg-[#ff5a0a] px-5 py-3 font-black text-white disabled:opacity-50">Create login</button>
        </form>}

        <section className="space-y-3" aria-label="Existing logins">
          <h2 className="text-xl font-black">Existing {scope === "super_admin" ? "Super Admin accounts" : scope === "gym_staff" ? "Staff Portal logins" : "system users"}</h2>
          {loading ? <p className="rounded-xl bg-white p-5 text-zinc-600">Loading accounts…</p>
            : shownUsers.length === 0 ? <p className="rounded-xl bg-white p-5 text-zinc-600">No accounts found in this view.</p>
              : shownUsers.map((user) => <SystemUserCard key={user.id} user={user} staffPath={gyms.find((gym) => gym.id === user.gymId)?.staffPath} disabled={saving} onUpdate={updateUser}/>)}
        </section>
      </div>
    </main>
  );
}
function SystemUserCard({
  user, staffPath, disabled, onUpdate,
}: {
  user: SystemUser; staffPath?: string | null; disabled: boolean;
  onUpdate: (user: SystemUser, changes: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editUsername, setEditUsername] = useState(user.username);
  const [editName, setEditName] = useState(user.displayName);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => { setEditUsername(user.username); setEditName(user.displayName); }, [user.username, user.displayName]);
  const changed = editUsername.trim() !== user.username || editName.trim() !== user.displayName;
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h3 className="text-lg font-black">{user.displayName}</h3><span className={user.isSuperAdmin ? "rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-700" : "rounded-full bg-zinc-100 px-2 py-1 text-xs font-black text-zinc-700"}>{user.isSuperAdmin ? "SUPER ADMIN" : "GYM STAFF"}</span></div>
          <p className="mt-1 text-sm text-zinc-600">@{user.username}{user.gymName ? " · " + user.gymName : ""}</p>
          {staffPath && <a href={staffPath} className="mt-1 block text-sm font-bold text-orange-700 underline">{staffPath}</a>}
          <p className="mt-1 text-xs text-zinc-500">Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</p>
        </div>
        <button type="button" disabled={disabled} onClick={() => { void onUpdate(user, { active: !user.active }); }} className={user.active ? "rounded-xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800 disabled:opacity-40" : "rounded-xl bg-red-100 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-40"}>{user.active ? "ACTIVE · Disable" : "INACTIVE · Enable"}</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-sm font-bold">Username
          <input aria-label={user.username + " edit username"} autoComplete="off" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"/>
        </label>
        <label className="text-sm font-bold">Display name
          <input aria-label={user.username + " edit display name"} value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"/>
        </label>
        <button type="button" disabled={!changed || !editUsername.trim() || !editName.trim() || disabled} onClick={() => { void onUpdate(user, { username: editUsername.trim(), displayName: editName.trim() }); }} className="rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Save details</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-zinc-50 p-4">
        <label className="min-w-48 flex-1 text-sm font-bold">Reset password
          <input aria-label={user.username + " new password"} type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (optional)" className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"/>
        </label>
        <button type="button" disabled={newPassword.length < 8 || disabled} onClick={async () => {
          const ok = await onUpdate(user, { password: newPassword });
          if (ok) setNewPassword("");
        }} className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black disabled:opacity-40">Change password</button>
      </div>
    </article>
  );
}
