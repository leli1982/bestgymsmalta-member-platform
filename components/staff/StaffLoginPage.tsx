"use client";

import { useEffect, useState } from "react";
import StaffDashboard from "@/components/staff/StaffDashboard";

type SystemUser = {
  id: string;
  gymId: string | null;
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  role?: "gym_staff" | "gym_manager" | "super_admin";
  permissions: string[];
};

type ExpectedGym = {
  id: string;
  name: string;
  shortName: string;
  gymSlug: string;
};

type CachedOfflineSession = {
  version: 1;
  cachedAt: number;
  expiresAt: number;
  expectedGymId: string | null;
  user: SystemUser;
};

const OFFLINE_SESSION_KEY = "bgmStaffOfflineSessionV1";
const OFFLINE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function clearOfflineSession() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(OFFLINE_SESSION_KEY); } catch {}
}

function saveOfflineSession(user: SystemUser, expectedGymId: string | null) {
  if (typeof window === "undefined") return;
  if (user.isSuperAdmin || user.role === "super_admin") {
    clearOfflineSession();
    return;
  }
  const now = Date.now();
  const record: CachedOfflineSession = {
    version: 1,
    cachedAt: now,
    expiresAt: now + OFFLINE_SESSION_TTL_MS,
    expectedGymId,
    user,
  };
  try { window.localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(record)); } catch {}
}

function loadOfflineSession(expectedGymId: string | null): SystemUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as CachedOfflineSession;
    if (record.version !== 1 || !record.user || record.expiresAt <= Date.now()) {
      clearOfflineSession();
      return null;
    }
    if (record.user.isSuperAdmin || record.user.role === "super_admin") {
      clearOfflineSession();
      return null;
    }
    if (expectedGymId && record.user.gymId !== expectedGymId) return null;
    if (record.expectedGymId && expectedGymId && record.expectedGymId !== expectedGymId) return null;
    return record.user;
  } catch {
    clearOfflineSession();
    return null;
  }
}

export default function StaffLoginPage({ expectedGym }: { expectedGym?: ExpectedGym }) {
  const [user, setUser] = useState<SystemUser | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function checkSession() {
    try {
      const response = await fetch("/api/system/auth", { cache: "no-store" });
      const data = await response.json();
      const sessionUser = data.authenticated ? data.user : null;
      if (!expectedGym && sessionUser?.role === "gym_manager") {
        clearOfflineSession();
        window.location.replace("/manager");
        return;
      }
      if (
        expectedGym &&
        sessionUser &&
        !sessionUser.isSuperAdmin &&
        sessionUser.gymId !== expectedGym.id
      ) {
        await fetch("/api/system/auth", { method: "DELETE" });
        clearOfflineSession();
        setUser(null);
        setOfflineMode(false);
      } else {
        setUser(sessionUser);
        setOfflineMode(false);
        if (sessionUser) saveOfflineSession(sessionUser, expectedGym?.id || null);
        else clearOfflineSession();
      }
    } catch {
      const cached = loadOfflineSession(expectedGym?.id || null);
      if (cached) {
        setUser(cached);
        setOfflineMode(true);
      } else {
        setUser(null);
        setOfflineMode(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkSession();
    const reconnect = () => void checkSession();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [expectedGym?.id]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/system/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          expectedGym
            ? { gymSlug: expectedGym.gymSlug, password }
            : { username, password }
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      if (!expectedGym && data.user?.role === "gym_manager") {
        clearOfflineSession();
        window.location.replace("/manager");
        return;
      }
      if (
        expectedGym &&
        !data.user?.isSuperAdmin &&
        data.user?.gymId !== expectedGym.id
      ) {
        setError("This staff login is not assigned to this gym.");
        return;
      }
      setUser(data.user);
      setOfflineMode(false);
      saveOfflineSession(data.user, expectedGym?.id || null);
      window.dispatchEvent(new Event("bgm-staff-auth-changed"));
      setPassword("");
    } catch {
      setError("Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    clearOfflineSession();
    try { await fetch("/api/system/auth", { method: "DELETE" }); } catch {}
    setUser(null);
    setOfflineMode(false);
    window.dispatchEvent(new Event("bgm-staff-auth-changed"));
    setUsername("");
    setPassword("");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">Loading…</main>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-600">BestGymsMalta</p>
            <h1 className="mt-2 text-3xl font-bold">
              {expectedGym ? expectedGym.shortName : "Staff & Reception"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {expectedGym
                ? `Staff & Reception · ${expectedGym.name}`
                : "Sign in with your Staff or Gym Manager credentials."}
            </p>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={login} className="space-y-4">
            {!expectedGym && (
              <label className="block text-sm font-semibold">
                Username
                <input autoCapitalize="none" autoCorrect="off" required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-400 caret-white outline-none focus:border-orange-500" placeholder="birkirkarafitness" />
              </label>
            )}
            <label className="block text-sm font-semibold">
              {expectedGym ? "Staff password" : "Password"}
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-400 caret-white outline-none focus:border-orange-500" placeholder="Enter password" />
            </label>
            {expectedGym && (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
                This login is locked to {expectedGym.name}. No gym selection is required.
              </p>
            )}
            <button disabled={submitting} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50">{submitting ? "Signing in…" : "Sign In"}</button>
          </form>
        </div>
      </main>
    );
  }

  return <StaffDashboard user={user} onLogout={logout} offlineMode={offlineMode} />;
}
