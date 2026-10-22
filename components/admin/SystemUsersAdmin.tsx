"use client";

import { formatEuropeanDateTime } from "@/lib/europeanDate";
import ManagerWhatsappReportSetting from "@/components/admin/ManagerWhatsappReportSetting";
import { useEffect, useMemo, useState } from "react";

type Scope = "all" | "super_admin" | "gym_staff" | "gym_manager";
type Role = "gym_staff" | "gym_manager" | "super_admin";
type Gym = { id: string; name: string; staffPath?: string | null; status: string };
type SystemUser = {
  id: string;
  gymId: string | null;
  gymName: string | null;
  managerGymIds: string[];
  managerGymNames: string[];
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  role: Role;
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

function gymStatusLabel(status: string) {
  if (status === "coming_soon") return "Coming soon";
  if (status === "inactive") return "Inactive";
  return "Active";
}

function GymStatusBadge({ status }: { status: string }) {
  if (status === "active") return null;
  return <span className={status === "inactive"
    ? "rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-700"
    : "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800"}>{gymStatusLabel(status)}</span>;
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
  const [newRole, setNewRole] = useState<Role>(scope === "super_admin" ? "super_admin" : scope === "gym_manager" ? "gym_manager" : "gym_staff");
  const [gymId, setGymId] = useState(initialGymId);
  const [managerGymIds, setManagerGymIds] = useState<string[]>([]);
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
    const assigned = new Set(users.filter((user) => user.role === "gym_staff" && user.gymId).map((user) => user.gymId));
    return gyms.filter((gym) => !assigned.has(gym.id));
  }, [users, gyms]);
  const assignableManagerGyms = useMemo(() => gyms.filter((gym) => gym.status !== "inactive"), [gyms]);
  const shownUsers = users.filter((user) =>
    (scope === "all" || (scope === "super_admin" ? user.role === "super_admin" : scope === "gym_manager" ? user.role === "gym_manager" : user.role === "gym_staff"))
    && (!initialGymId || user.role === "super_admin" || user.gymId === initialGymId)
  );
  const role: Role = scope === "super_admin" ? "super_admin" : scope === "gym_manager" ? "gym_manager" : scope === "gym_staff" ? "gym_staff" : newRole;
  const heading = scope === "super_admin" ? "Super Admin accounts"
    : scope === "gym_manager" ? "Gym Manager accounts"
      : scope === "gym_staff" ? "Staff Portal logins" : "System Users";

  function toggleManagerGym(id: string) {
    setManagerGymIds((current) => current.includes(id) ? current.filter((gym) => gym !== id) : [...current, id]);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage(""); setError(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/system-users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          gymId: role === "gym_staff" ? gymId : null,
          managerGymIds: role === "gym_manager" ? managerGymIds : [],
          username,
          displayName,
          password,
          isSuperAdmin: role === "super_admin",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create system login.");
      setUsername(""); setDisplayName(""); setPassword(""); setGymId(initialGymId); setManagerGymIds([]);
      if (scope === "all") setNewRole("gym_staff");
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
              : scope === "gym_manager" ? "Create Gym Manager logins and assign one or more current or coming-soon gym locations."
                : scope === "gym_staff" ? "Each gym has one shared Staff Portal login. Assign a password or reset an existing one here."
                  : "Manage Gym Staff, Gym Manager and Super Admin logins."}
            {" "}Passwords are never displayed; set or reset them instead.
          </p>
          {(scope === "gym_staff" || scope === "gym_manager") && <a href="/staff/admin/gyms" className="mt-3 inline-block text-sm font-bold text-orange-700 underline">Manage gym locations and status</a>}
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        {scope === "gym_staff" && initialGymId && !availableGyms.some((gym) => gym.id === initialGymId) ?
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-600">This gym already has a Staff Portal login. Edit its username, password or active status in the account below.</p> :
        <form onSubmit={(event) => void createUser(event)} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">{role === "super_admin" ? "Add Super Admin login" : role === "gym_manager" ? "Add Gym Manager login" : "Assign a Staff Portal login"}</h2>
          {scope === "all" && <div className="mt-4 flex flex-wrap gap-3">
            {(["gym_staff", "gym_manager", "super_admin"] as Role[]).map((option) => (
              <button key={option} type="button" onClick={() => { setNewRole(option); setGymId(""); setManagerGymIds([]); }} className={role === option ? "rounded-xl bg-orange-600 px-4 py-2 font-bold text-white" : "rounded-xl bg-zinc-100 px-4 py-2 font-bold"}>
                {option === "gym_staff" ? "Gym Staff" : option === "gym_manager" ? "Gym Manager" : "Super Admin"}
              </button>
            ))}
          </div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {role === "gym_staff" && <label className="text-sm font-bold">Gym
              <select aria-label="Gym for staff login" required value={gymId} onChange={(event) => setGymId(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3">
                <option value="">Select gym</option>{availableGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-zinc-500">Gyms with an existing shared staff account are managed below, not created twice.</span>
            </label>}
            <label className="text-sm font-bold">Display name<input aria-label="New login display name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder={role === "super_admin" ? "Super Admin" : role === "gym_manager" ? "North Region Manager" : "Naxxar Staff"}/></label>
            <label className="text-sm font-bold">Username<input aria-label="New login username" required autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder={role === "super_admin" ? "adminname" : role === "gym_manager" ? "managername" : "naxxarfitness"}/></label>
            <label className="text-sm font-bold">Set password<input aria-label="New login password" required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3" placeholder="At least 8 characters"/></label>
          </div>
          {role === "gym_manager" && <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-black">Assigned gyms</p>
            <p className="mt-1 text-xs text-zinc-500">Active and Coming Soon gyms are available automatically from Gym locations. Inactive gyms cannot be newly assigned.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {assignableManagerGyms.map((gym) => <label key={gym.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold"><input type="checkbox" checked={managerGymIds.includes(gym.id)} onChange={() => toggleManagerGym(gym.id)}/><span>{gym.name}</span><GymStatusBadge status={gym.status}/></label>)}
            </div>
            {assignableManagerGyms.length === 0 && <p className="mt-3 text-sm font-semibold text-zinc-500">No Active or Coming Soon gyms are available.</p>}
          </div>}
          {role === "gym_staff" && <div className="mt-4"><GymStaffAccessSummary/></div>}
          {role === "gym_manager" && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Gym Managers can view New Membership, Renewal and total membership figures only for assigned gyms. They do not receive operational Staff or Super Admin permissions.</p>}
          {role === "super_admin" && <p className="mt-4 rounded-xl bg-orange-50 p-4 text-sm font-bold text-orange-800">Super Admin accounts have unrestricted BGM management access. Only assign this role to trusted people.</p>}
          <button type="submit" disabled={saving || loading || (role === "gym_manager" && managerGymIds.length === 0)} className="mt-5 rounded-xl bg-[#ff5a0a] px-5 py-3 font-black text-white disabled:opacity-50">Create login</button>
        </form>}

        <section className="space-y-3" aria-label="Existing logins">
          <h2 className="text-xl font-black">Existing {scope === "super_admin" ? "Super Admin accounts" : scope === "gym_manager" ? "Gym Manager accounts" : scope === "gym_staff" ? "Staff Portal logins" : "system users"}</h2>
          {loading ? <p className="rounded-xl bg-white p-5 text-zinc-600">Loading accounts…</p>
            : shownUsers.length === 0 ? <p className="rounded-xl bg-white p-5 text-zinc-600">No accounts found in this view.</p>
              : shownUsers.map((user) => <SystemUserCard key={user.id} user={user} gyms={gyms} staffPath={gyms.find((gym) => gym.id === user.gymId)?.staffPath} disabled={saving} onUpdate={updateUser}/>)}
        </section>
      </div>
    </main>
  );
}
function SystemUserCard({
  user, gyms, staffPath, disabled, onUpdate,
}: {
  user: SystemUser; gyms: Gym[]; staffPath?: string | null; disabled: boolean;
  onUpdate: (user: SystemUser, changes: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editUsername, setEditUsername] = useState(user.username);
  const [editName, setEditName] = useState(user.displayName);
  const [editManagerGyms, setEditManagerGyms] = useState<string[]>(user.managerGymIds || []);
  const [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    setEditUsername(user.username);
    setEditName(user.displayName);
    setEditManagerGyms(user.managerGymIds || []);
  }, [user.username, user.displayName, user.managerGymIds]);
  const changed = editUsername.trim() !== user.username || editName.trim() !== user.displayName;
  const managerGymsChanged = user.role === "gym_manager" && JSON.stringify([...editManagerGyms].sort()) !== JSON.stringify([...(user.managerGymIds || [])].sort());
  const managerGymOptions = gyms.filter((gym) => gym.status !== "inactive" || user.managerGymIds.includes(gym.id));
  const assignedManagerGyms = user.role === "gym_manager"
    ? user.managerGymIds.map((id) => gyms.find((gym) => gym.id === id) || { id, name: id, status: "inactive" })
    : [];
  const badge = user.role === "super_admin" ? "SUPER ADMIN" : user.role === "gym_manager" ? "GYM MANAGER" : "GYM STAFF";
  const badgeClass = user.role === "super_admin" ? "bg-orange-100 text-orange-700" : user.role === "gym_manager" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-700";
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h3 className="text-lg font-black">{user.displayName}</h3><span className={`rounded-full px-2 py-1 text-xs font-black ${badgeClass}`}>{badge}</span></div>
          <p className="mt-1 text-sm text-zinc-600">@{user.username}{user.gymName ? " · " + user.gymName : ""}</p>
          {user.role === "gym_manager" && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-blue-700"><span>Assigned:</span>{assignedManagerGyms.length === 0 ? <span>No gyms</span> : assignedManagerGyms.map((gym) => <span key={gym.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1"><span>{gym.name}</span><GymStatusBadge status={gym.status}/></span>)}</div>}
          {staffPath && <a href={staffPath} className="mt-1 block text-sm font-bold text-orange-700 underline">{staffPath}</a>}
          <p className="mt-1 text-xs text-zinc-500">Last login: {user.lastLoginAt ? formatEuropeanDateTime(user.lastLoginAt) : "Never"}</p>
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
      {user.role === "gym_manager" && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-black text-blue-950">Manager gym assignments</p>
        <p className="mt-1 text-xs text-blue-800">Active and Coming Soon gyms can be added. An Inactive gym already assigned remains visible until you remove it.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {managerGymOptions.map((gym) => <label key={gym.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold"><input type="checkbox" checked={editManagerGyms.includes(gym.id)} onChange={() => setEditManagerGyms((current) => current.includes(gym.id) ? current.filter((id) => id !== gym.id) : [...current, gym.id])}/><span>{gym.name}</span><GymStatusBadge status={gym.status}/></label>)}
        </div>
        <button type="button" disabled={!managerGymsChanged || editManagerGyms.length === 0 || disabled} onClick={() => { void onUpdate(user, { managerGymIds: editManagerGyms }); }} className="mt-3 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Save assigned gyms</button>
      </div>}
      {user.role === "gym_manager" && <ManagerWhatsappReportSetting managerUserId={user.id} managerUsername={user.username} disabled={disabled}/>} 
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
