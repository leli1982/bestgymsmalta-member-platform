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
    <div className="space-y-6">
      <section
        className="relative min-h-[390px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/account.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/25 to-black/85" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[340px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Password Reset
              </p>
            </div>

            <img
              src="/bgm-logo.png"
              alt="BestGymsMalta"
              className="h-16 w-16 object-contain drop-shadow-2xl"
            />
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[.24em] text-[#fcb415]">
              BestGymsMalta
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Create a new password
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Choose a new password for your BGM app account.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        {success ? (
          <div className="text-center">
            <BadgeCheck
              className="mx-auto text-[#fcb415]"
              size={48}
              strokeWidth={3}
            />

            <h2 className="mt-4 text-3xl font-black text-white">
              Password updated
            </h2>

            <p className="mt-3 text-sm font-bold leading-6 text-white/55">
              You can now log in with your new password.
            </p>

            <a
              href="/member-login"
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              Go to Login
              <ChevronRight size={17} strokeWidth={3} />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck
                className="text-[#fcb415]"
                size={24}
                strokeWidth={3}
              />

              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Secure Reset
                </p>

                <h2 className="mt-1 text-2xl font-black text-white">
                  New password
                </h2>
              </div>
            </div>

            {!token ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-200">
                This reset link is invalid. Please request a new password reset.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-200">
                {error}
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                New Password
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <KeyRound className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Confirm Password
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <Lock className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading || !token}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
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
        )}
      </section>
    </div>
  );
}
