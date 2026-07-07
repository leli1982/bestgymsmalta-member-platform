"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bot,
  Camera,
  ChevronRight,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Stamp,
  User,
  Video,
} from "lucide-react";
import {
  clearSavedMember,
  getSavedMember,
  saveMember,
  type AppMember,
} from "@/lib/memberSession";

type Mode = "login" | "activate" | "forgot";

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isMembershipActive(member: AppMember | null) {
  if (!member) return false;

  if (member.status && member.status !== "active") return false;

  if (!member.membershipExpiry) return true;

  return new Date(member.membershipExpiry).getTime() >= Date.now();
}

const quickLinks = [
  {
    label: "Passport",
    description: "View your gym stamps",
    href: "/passport",
    icon: Stamp,
  },
  {
    label: "Trainer",
    description: "Your AI workout plan",
    href: "/trainer",
    icon: Bot,
  },
  {
    label: "Story",
    description: "Create a BGM story",
    href: "/story",
    icon: Video,
  },
  {
    label: "Progress",
    description: "Private photo vault",
    href: "/progress",
    icon: Camera,
  },
];

export default function MemberLoginPage() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [mode, setMode] = useState<Mode>("login");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [memberNumber, setMemberNumber] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [activatePassword, setActivatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = useMemo(() => isMembershipActive(member), [member]);

  useEffect(() => {
    setMember(getSavedMember());
  }, []);

  function handleLogout() {
    clearSavedMember();
    setMember(null);
    setMode("login");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError("Enter your username and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/member/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      const loggedInMember = data.member || data;

      saveMember(loggedInMember);
      setMember(loggedInMember);
      setLoginPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setForgotMessage("");

    if (!forgotEmail.trim()) {
      setError("Enter your registered email address.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/member/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: forgotEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not send reset email.");
      }

      setForgotMessage(
        data.message || "If that email is registered, we have sent a password reset link."
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!memberNumber.trim() || !email.trim() || !username.trim()) {
      setError("Enter your member number, email and username.");
      return;
    }

    if (activatePassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (activatePassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/member/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberNumber: memberNumber.trim(),
          email: email.trim(),
          username: username.trim(),
          password: activatePassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Activation failed.");
      }

      const activatedMember = data.member || data;

      saveMember(activatedMember);
      setMember(activatedMember);
      setActivatePassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  if (member) {
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
                  Member Account
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
                Welcome back
              </p>

              <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
                {member.fullName || member.username}
              </h1>

              <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
                Your membership, app tools and account details in one place.
              </p>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      active ? "bg-[#fcb415] text-black" : "bg-red-500/15 text-red-200"
                    }`}
                  >
                    <BadgeCheck size={25} strokeWidth={3} />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                      Membership Status
                    </p>

                    <p
                      className={`mt-1 text-xl font-black ${
                        active ? "text-white" : "text-red-200"
                      }`}
                    >
                      {active ? "Active" : "Inactive / Expired"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="text-[#fcb415]" size={25} strokeWidth={3} />

            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Membership Details
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Your BGM profile
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Member Number
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {member.memberNumber || "Not set"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Email
              </p>
              <p className="mt-1 break-all text-sm font-bold text-white/70">
                {member.email || "Not set"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Valid Until
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {formatDate(member.membershipExpiry)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-[#fcb415]"
              size={25}
              strokeWidth={3}
            />

            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                App Access
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Your app is activated
              </h2>

              <p className="mt-3 text-sm font-bold leading-6 text-white/60">
                This device is linked to your BGM member account. Your passport,
                progress photos, trainer plan and app activity are saved against
                your profile.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <Smartphone className="text-[#fcb415]" size={25} strokeWidth={3} />

            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Member Tools
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Open your app tools
              </h2>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 transition hover:bg-white/[0.06]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
                    <Icon size={24} strokeWidth={3} />
                  </div>

                  <h3 className="mt-4 text-lg font-black text-white">
                    {item.label}
                  </h3>

                  <p className="mt-1 text-xs font-bold leading-5 text-white/45">
                    {item.description}
                  </p>
                </a>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-200"
        >
          <LogOut size={18} strokeWidth={3} />
          Logout
        </button>
      </div>
    );
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
                BestGymsMalta
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
              Member Access
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Activate your BGM app
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Login or activate your app account using your BGM membership
              details.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="grid grid-cols-2 gap-3 rounded-full border border-white/10 bg-black/25 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-full px-5 py-3 text-sm font-black ${
              mode === "login" ? "bg-[#fcb415] text-black" : "text-white/45"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("activate");
              setError("");
            }}
            className={`rounded-full px-5 py-3 text-sm font-black ${
              mode === "activate" ? "bg-[#fcb415] text-black" : "text-white/45"
            }`}
          >
            Activate
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-200">
            {error}
          </div>
        ) : null}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-5 grid gap-4">
            <div className="flex items-center gap-3">
              <Lock className="text-[#fcb415]" size={24} strokeWidth={3} />

              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Login
                </p>

                <h2 className="mt-1 text-2xl font-black text-white">
                  Access your account
                </h2>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Username
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <User className="text-white/30" size={18} strokeWidth={3} />
                <input
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  placeholder="Your username"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Password
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <KeyRound className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Your password"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setForgotMessage("");
              }}
              className="-mt-1 w-fit text-sm font-black text-[#fcb415]"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
                  Logging in…
                </>
              ) : (
                <>
                  Login
                  <ChevronRight size={17} strokeWidth={3} />
                </>
              )}
            </button>
          </form>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="mt-5 grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="text-[#fcb415]" size={24} strokeWidth={3} />

              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Forgot Password
                </p>

                <h2 className="mt-1 text-2xl font-black text-white">
                  Reset your password
                </h2>
              </div>
            </div>

            <p className="text-sm font-bold leading-6 text-white/45">
              Enter your registered membership email address. If it exists in
              the system, we will send you a secure reset link.
            </p>

            {forgotMessage ? (
              <div className="rounded-2xl border border-[#fcb415]/25 bg-[#fcb415]/10 p-4 text-sm font-bold leading-6 text-white/70">
                {forgotMessage}
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Registered Email
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <Mail className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="Your membership email"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  Send Reset Link
                  <ChevronRight size={17} strokeWidth={3} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setForgotMessage("");
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleActivate} className="mt-5 grid gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#fcb415]" size={24} strokeWidth={3} />

              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Activate
                </p>

                <h2 className="mt-1 text-2xl font-black text-white">
                  Link your membership
                </h2>
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Member Number
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <CreditCard className="text-white/30" size={18} strokeWidth={3} />
                <input
                  value={memberNumber}
                  onChange={(event) => setMemberNumber(event.target.value)}
                  placeholder="Example: BGM001"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Email
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <Mail className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your membership email"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Choose Username
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <User className="text-white/30" size={18} strokeWidth={3} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Create username"
                  className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                Password
              </span>

              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <KeyRound className="text-white/30" size={18} strokeWidth={3} />
                <input
                  type="password"
                  value={activatePassword}
                  onChange={(event) => setActivatePassword(event.target.value)}
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
                <KeyRound className="text-white/30" size={18} strokeWidth={3} />
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
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw size={17} strokeWidth={3} className="animate-spin" />
                  Activating…
                </>
              ) : (
                <>
                  Activate App
                  <ChevronRight size={17} strokeWidth={3} />
                </>
              )}
            </button>

            <p className="text-center text-xs font-bold leading-5 text-white/35">
              Your membership must first be added by BGM admin before activation
              works.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
