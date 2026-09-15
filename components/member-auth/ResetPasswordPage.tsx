"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

export default function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/member/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not reset password.");
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-member-surface="reset-password-light" className="space-y-6 text-zinc-950">
      <section
        className="relative min-h-[285px] overflow-hidden rounded-[2.2rem] bg-cover bg-center p-6 shadow-xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(255,90,10,.24), rgba(0,0,0,.72)), url('/visuals/account.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/85" />
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
        <div className="relative flex min-h-[235px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a] backdrop-blur-md">
              Password Reset
            </span>
            <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-14 w-14 object-contain drop-shadow-xl" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-[#ff5a0a]">BestGymsMalta</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">Create a new password</h1>
            <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/65">Choose a new password for your BGM app account.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        {success ? (
          <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <BadgeCheck size={30} strokeWidth={3} />
            </div>
            <h2 className="mt-4 text-3xl font-black text-zinc-950">Password updated</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">You can now log in with your new password.</p>
            <a href="/member-login" className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100">
              Go to Login
              <ChevronRight size={17} strokeWidth={3} />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]">
                <ShieldCheck size={24} strokeWidth={3} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Secure Reset</p>
                <h2 className="mt-1 text-2xl font-black text-zinc-950">New password</h2>
              </div>
            </div>

            {!token ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                This reset link is invalid. Please request a new password reset.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">{error}</div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">New Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <KeyRound className="text-zinc-400" size={18} strokeWidth={3} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 characters" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Confirm Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <Lock className="text-zinc-400" size={18} strokeWidth={3} />
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" />
              </div>
            </label>

            <button type="submit" disabled={loading || !token} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60">
              {loading ? <><RefreshCw size={17} strokeWidth={3} className="animate-spin" />Updating…</> : <>Update Password<ChevronRight size={17} strokeWidth={3} /></>}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
