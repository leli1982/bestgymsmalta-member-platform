"use client";

import { useEffect, useState } from "react";
import {
  registerStaffServiceWorker,
  syncOfflineRoster,
} from "@/lib/offlineRosterClient";

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
  const [offlineSyncMessage, setOfflineSyncMessage] = useState("");

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

  useEffect(() => {
    void registerStaffServiceWorker();
    void checkSession();
  }, []);

  useEffect(() => {
    if (!user) return;

    const canUseOfflineRoster =
      user.isSuperAdmin || user.permissions.includes("offline_roster.view");
    if (!canUseOfflineRoster) return;

    let midnightTimer: ReturnType<typeof setTimeout> | null = null;
    let dailyTimer: ReturnType<typeof setInterval> | null = null;

    const sync = async () => {
      if (!navigator.onLine) return;
      try {
        const snapshot = await syncOfflineRoster();
        setOfflineSyncMessage(
          `Offline roster updated: ${snapshot.memberCount} active members.`
        );
      } catch {
        setOfflineSyncMessage(
          "Offline roster could not refresh. The last saved copy remains available."
        );
      }
    };

    const scheduleMidnightSync = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime());

      midnightTimer = setTimeout(() => {
        void sync();
        dailyTimer = setInterval(() => void sync(), 24 * 60 * 60 * 1000);
      }, delay);
    };

    void sync();
    scheduleMidnightSync();
    window.addEventListener("online", sync);

    return () => {
      window.removeEventListener("online", sync);
      if (midnightTimer) clearTimeout(midnightTimer);
      if (dailyTimer) clearInterval(dailyTimer);
    };
  }, [user]);

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

      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }

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
    setUser(null);
    setUsername("");
    setPassword("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Loading…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
              BestGymsMalta
            </p>
            <h1 className="mt-2 text-3xl font-bold">Staff & Reception</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Sign in with the shared system account for your gym.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm font-semibold">
              Username
              <input
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
                placeholder="birkirkarafitness"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-orange-500"
              />
            </label>
            <button
              disabled={submitting}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <a
            href="/staff/offline"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800"
          >
            Emergency Offline Member Lookup
          </a>
        </div>
      </main>
    );
  }

  const canUseOfflineRoster =
    user.isSuperAdmin || user.permissions.includes("offline_roster.view");

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">
              BestGymsMalta
            </p>
            <h1 className="mt-1 text-2xl font-bold">{user.displayName}</h1>
            <p className="mt-1 text-sm text-zinc-500">@{user.username}</p>
          </div>
          <div className="flex items-center gap-3">
            {user.isSuperAdmin && (
              <span className="rounded-full bg-orange-100 px-3 py-2 text-xs font-bold text-orange-700">
                SUPER ADMIN
              </span>
            )}
            <button
              onClick={logout}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              Log out
            </button>
          </div>
        </header>

        {canUseOfflineRoster && offlineSyncMessage && (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
            {offlineSyncMessage}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">System access</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Features appear according to this account&apos;s current permissions.
          </p>

          {user.isSuperAdmin ? (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
              Super Admin has unrestricted access to every BGM management and reception feature.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {user.permissions.map((permission) => (
                <div
                  key={permission}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium"
                >
                  {permission}
                </div>
              ))}
              {user.permissions.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No permissions have been assigned yet.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Members"
            enabled={user.isSuperAdmin || user.permissions.includes("members.view")}
          />
          <FeatureCard
            title="Reception / NFC"
            enabled={user.isSuperAdmin || user.permissions.includes("nfc.scan")}
          />
          <FeatureCard
            title="Sundries"
            enabled={
              user.isSuperAdmin ||
              user.permissions.includes("orders.sundries.submit")
            }
          />
          <FeatureCard
            title="Bar List"
            enabled={
              user.isSuperAdmin || user.permissions.includes("orders.bar.submit")
            }
          />
          <FeatureCard title="Offline Roster" enabled={canUseOfflineRoster} />
          <FeatureCard
            title="Analytics"
            enabled={
              user.isSuperAdmin || user.permissions.includes("analytics.view")
            }
          />
        </section>

        <div className="flex flex-wrap gap-3">
          {canUseOfflineRoster && (
            <a
              href="/staff/offline"
              className="inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white"
            >
              Open Offline Roster
            </a>
          )}
          {user.isSuperAdmin && (
            <a
              href="/bgm-admin/system-users"
              className="inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white"
            >
              Manage System Users
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ title, enabled }: { title: string; enabled: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        enabled
          ? "border-zinc-200 bg-white"
          : "border-zinc-200 bg-zinc-200/60 opacity-60"
      }`}
    >
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {enabled ? "Available to this account" : "Not permitted"}
      </p>
    </div>
  );
}
