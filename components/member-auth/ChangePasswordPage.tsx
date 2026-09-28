"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Choose a new password different from your current password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/member/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Could not change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-member-surface="change-password-light" className="space-y-5 text-zinc-950">
      <a
        href="/member-login"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"
      >
        <ArrowLeft size={17} /> Member account
      </a>

      <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a0a]">
            Account Security
          </span>
          <ShieldCheck className="mt-6 text-[#ff5a0a]" size={34} strokeWidth={3} />
          <h1 className="mt-4 text-3xl font-black">Change password</h1>
          <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-white/65">
            Confirm your current password, then choose a new password for your BGM member account.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <BadgeCheck className="shrink-0 text-emerald-700" size={24} strokeWidth={3} />
              <div>
                <p className="font-black text-emerald-900">Password updated</p>
                <p className="mt-1 text-sm font-bold text-emerald-800">
                  Your new password is active immediately.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">
              Current password
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <Lock className="text-zinc-400" size={18} strokeWidth={3} />
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
                placeholder="Current password"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">
              New password
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <KeyRound className="text-zinc-400" size={18} strokeWidth={3} />
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">
              Confirm new password
            </span>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <KeyRound className="text-zinc-400" size={18} strokeWidth={3} />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
                placeholder="Repeat new password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw size={17} className="animate-spin" strokeWidth={3} />
                Updating…
              </>
            ) : (
              <>
                Update Password
                <ChevronRight size={17} strokeWidth={3} />
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
