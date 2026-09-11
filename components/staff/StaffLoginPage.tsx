"use client";

import { useEffect, useState } from "react";

type SystemUser = {
  id: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

export default function StaffLoginPage() {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function checkSession() {
    try {
      const response = await fetch("/api/system/auth", { cache: "no-store" });
      const data = await response.json();
      setUser(data.authenticated ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void checkSession(); }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/system/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Login failed."); return; }
      setUser(data.user);
      setPassword("");
    } catch {
      setError("Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/system/auth", { method: "DELETE" });
    setUser(null); setUsername(""); setPassword("");
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">Loading…</main>;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
            <h1 className="mt-2 text-3xl font-bold">Staff & Reception</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Sign in with the shared Gym Staff account for your location.</p>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm font-semibold">Username<input autoCapitalize="none" autoCorrect="off" required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500" placeholder="birkirkarafitness" /></label>
            <label className="block text-sm font-semibold">Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500" /></label>
            <button disabled={submitting} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50">{submitting ? "Signing in…" : "Sign In"}</button>
          </form>
        </div>
      </main>
    );
  }

  const canManageMemberships = user.isSuperAdmin || user.permissions.includes("members.create") || user.permissions.includes("members.renew");

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p><h1 className="mt-1 text-2xl font-bold">{user.displayName}</h1><p className="mt-1 text-sm text-zinc-500">@{user.username}</p></div>
          <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-2 text-xs font-bold ${user.isSuperAdmin ? "bg-orange-100 text-orange-700" : "bg-zinc-200 text-zinc-700"}`}>{user.isSuperAdmin ? "SUPER ADMIN" : "GYM STAFF"}</span><button onClick={logout} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">Log out</button></div>
        </header>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Daily operations</h2><p className="mt-1 text-sm text-zinc-600">{user.isSuperAdmin ? "Super Admin can also use the management portal for network-wide tools." : "This shared gym login uses the fixed Gym Staff operational role."}</p></section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard title="Members" enabled={canManageMemberships} href="/staff/members/enroll" />
          <FeatureCard title="Reception / Barcode" enabled={user.isSuperAdmin || user.permissions.includes("barcode.scan")} href="/staff/reception" />
          <FeatureCard title="Sundries" enabled={user.isSuperAdmin || user.permissions.includes("orders.sundries.submit")} href="/staff/sundries" />
          <FeatureCard title="Bar List" enabled={user.isSuperAdmin || user.permissions.includes("orders.bar.submit")} href="/staff/bar" />
        </section>
        {user.isSuperAdmin && <a href="/bgm-admin" className="inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white">Open Management Portal</a>}
      </div>
    </main>
  );
}

function FeatureCard({ title, enabled, href }: { title: string; enabled: boolean; href: string }) {
  const className = `rounded-2xl border p-5 ${enabled ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-200/60 opacity-60"}`;
  const content = <><p className="font-bold">{title}</p><p className="mt-1 text-sm text-zinc-500">{enabled ? "Open" : "Not permitted"}</p></>;
  return enabled ? <a href={href} className={className}>{content}</a> : <div className={className}>{content}</div>;
}
