"use client";

import { useEffect, useMemo, useState } from "react";
import { SYSTEM_PERMISSION_KEYS } from "@/lib/systemPermissions";

type Gym = { id: string; name: string };
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

const permissionLabels: Record<string, string> = {
  "members.view": "View members",
  "members.create": "Create members",
  "members.edit": "Edit members",
  "members.renew": "Renew memberships",
  "members.photos.view": "View member photos",
  "membership.activate": "Activate paid memberships",
  "nfc.scan": "Use NFC reception scanner",
  "nfc.assign": "Assign NFC cards",
  "nfc.replace": "Replace NFC cards",
  "checkins.view": "View check-ins",
  "orders.sundries.submit": "Submit sundries lists",
  "orders.sundries.history": "View sundries history",
  "orders.bar.submit": "Submit bar lists",
  "orders.bar.history": "View bar history",
  "announcements.manage": "Manage announcements",
  "analytics.view": "View analytics",
  "members.export": "Export members",
  "members.archive": "Archive members",
  "gyms.manage": "Manage gyms",
  "system_users.manage": "Manage system users",
  "offline_roster.view": "Use offline emergency roster",
};

function PermissionGrid({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (permissions: string[]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {SYSTEM_PERMISSION_KEYS.map((key) => {
        const checked = selected.includes(key);
        return (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? selected.filter((item) => item !== key)
                    : [...selected, key]
                )
              }
            />
            <span>{permissionLabels[key] || key}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function SystemUsersAdmin() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [gymId, setGymId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([
    "members.view",
    "members.create",
    "members.edit",
    "members.renew",
    "members.photos.view",
    "membership.activate",
    "nfc.scan",
    "nfc.assign",
    "nfc.replace",
    "checkins.view",
    "orders.sundries.submit",
    "orders.sundries.history",
    "orders.bar.submit",
    "orders.bar.history",
    "offline_roster.view",
  ]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, gymsResponse] = await Promise.all([
        fetch("/api/admin/system-users", { cache: "no-store" }),
        fetch("/api/gyms", { cache: "no-store" }),
      ]);

      if (!usersResponse.ok) {
        throw new Error(
          usersResponse.status === 401
            ? "Please authenticate in the main BGM Admin page first."
            : "Could not load system users."
        );
      }

      const usersData = await usersResponse.json();
      const gymsData = await gymsResponse.json();
      setUsers(usersData.users || []);
      setGyms(gymsData.gyms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load system users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const availableGyms = useMemo(() => {
    const assigned = new Set(users.filter((u) => u.gymId).map((u) => u.gymId));
    return gyms.filter((gym) => !assigned.has(gym.id));
  }, [gyms, users]);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    const response = await fetch("/api/admin/system-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gymId: isSuperAdmin ? null : gymId,
        username,
        displayName,
        password,
        isSuperAdmin,
        permissions: isSuperAdmin ? [] : permissions,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not create system user.");
      return;
    }

    setMessage(`${data.user.displayName} created.`);
    setUsername("");
    setDisplayName("");
    setPassword("");
    setGymId("");
    await load();
  }

  async function updateUser(user: SystemUser, changes: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/system-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, ...changes }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not update system user.");
      return;
    }
    setMessage(`${data.user.displayName} updated.`);
    await load();
  }

  if (loading) {
    return <div className="p-8 text-zinc-600">Loading system users…</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
            <h1 className="mt-1 text-3xl font-bold">System Users</h1>
            <p className="mt-2 text-sm text-zinc-600">One shared login per gym, with permissions controlled here. Super Admin bypasses all permission checks.</p>
          </div>
          <a href="/bgm-admin" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">Back to Admin</a>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>}

        <form onSubmit={createUser} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Create system login</h2>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setIsSuperAdmin(false)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${!isSuperAdmin ? "bg-orange-500 text-white" : "bg-zinc-100"}`}>Gym Login</button>
            <button type="button" onClick={() => setIsSuperAdmin(true)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${isSuperAdmin ? "bg-orange-500 text-white" : "bg-zinc-100"}`}>Super Admin</button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {!isSuperAdmin && (
              <label className="text-sm font-medium">Gym
                <select required value={gymId} onChange={(e) => setGymId(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2">
                  <option value="">Select gym</option>
                  {availableGyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm font-medium">Display name
              <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" placeholder={isSuperAdmin ? "Super Admin" : "Birkirkara Fitness"} />
            </label>
            <label className="text-sm font-medium">Username
              <input required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" placeholder={isSuperAdmin ? "superadmin" : "birkirkarafitness"} />
            </label>
            <label className="text-sm font-medium">Password
              <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2" placeholder="At least 8 characters" />
            </label>
          </div>

          {!isSuperAdmin && <div className="mt-5"><p className="mb-2 text-sm font-bold">Permissions</p><PermissionGrid selected={permissions} onChange={setPermissions} /></div>}
          <button className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white">Create Login</button>
        </form>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">Existing system users</h2>
          {users.length === 0 && <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">No system users yet. Create the first Super Admin above.</div>}
          {users.map((user) => <SystemUserCard key={user.id} user={user} onUpdate={updateUser} />)}
        </section>
      </div>
    </main>
  );
}

function SystemUserCard({ user, onUpdate }: { user: SystemUser; onUpdate: (user: SystemUser, changes: Record<string, unknown>) => Promise<void> }) {
  const [permissions, setPermissions] = useState(user.permissions);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => setPermissions(user.permissions), [user.permissions]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h3 className="font-bold">{user.displayName}</h3>{user.isSuperAdmin && <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">SUPER ADMIN</span>}</div>
          <p className="mt-1 text-sm text-zinc-500">@{user.username}{user.gymName ? ` · ${user.gymName}` : ""}</p>
          <p className="mt-1 text-xs text-zinc-400">Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</p>
        </div>
        <button onClick={() => onUpdate(user, { active: !user.active })} className={`rounded-xl px-4 py-2 text-sm font-bold ${user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{user.active ? "ACTIVE" : "DISABLED"}</button>
      </div>

      {!user.isSuperAdmin && <div className="mt-4"><PermissionGrid selected={permissions} onChange={setPermissions} /><button onClick={() => onUpdate(user, { permissions })} className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Save Permissions</button></div>}

      <div className="mt-4 flex max-w-md gap-2">
        <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (optional)" className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm" />
        <button type="button" disabled={newPassword.length < 8} onClick={async () => { await onUpdate(user, { password: newPassword }); setNewPassword(""); }} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Change</button>
      </div>
    </div>
  );
}
