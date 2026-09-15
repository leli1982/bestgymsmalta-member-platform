"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  cacheVerifiedMember,
  clearSavedMember,
  forgetSavedMember,
  MEMBER_SESSION_KEY,
  waitForMemberLogout,
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const sessionRequest = useRef(0);
  const authBusy = useRef(false);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [memberNumber, setMemberNumber] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [activatePassword, setActivatePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotMemberNumber, setForgotMemberNumber] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const active = useMemo(() => isMembershipActive(member), [member]);

  const checkSession = useCallback(async () => {
    if (authBusy.current) return;
    const version = ++sessionRequest.current;
    setCheckingSession(true);
    setSessionError("");
    try {
      await waitForMemberLogout();
      if (version !== sessionRequest.current) return;
      const response = await fetch("/api/member/auth/session", {
        cache: "no-store", credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);
      if (version !== sessionRequest.current) return;
      if (response.status === 401) {
        setMember(null);
        forgetSavedMember();
        return;
      }
      if (!response.ok || !data?.member?.id) throw new Error("Could not check your session. Please try again.");
      cacheVerifiedMember(data.member);
      setMember(data.member);
    } catch (error) {
      if (version !== sessionRequest.current) return;
      setMember(null);
      setSessionError(error instanceof Error ? error.message : "Could not check your session.");
    } finally {
      if (version === sessionRequest.current) setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    function onMemberChanged(event: Event) {
      if (authBusy.current) return;
      if ((event as CustomEvent<{ signedOut?: boolean }>).detail?.signedOut) {
        sessionRequest.current += 1;
        setMember(null);
        setCheckingSession(false);
        return;
      }
      void checkSession();
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== MEMBER_SESSION_KEY && event.key !== null) return;
      if (event.newValue === null) {
        sessionRequest.current += 1;
        setMember(null);
        setCheckingSession(false);
      } else void checkSession();
    }
    function onFocus() { void checkSession(); }
    void checkSession();
    window.addEventListener("bgmMemberChanged", onMemberChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      sessionRequest.current += 1;
      window.removeEventListener("bgmMemberChanged", onMemberChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkSession]);

  function returnToCard() {
    if (new URLSearchParams(window.location.search).get("returnTo") === "card") {
      window.location.assign("/card");
    }
  }

  async function handleLogout() {
    if (authBusy.current) return;
    authBusy.current = true;
    sessionRequest.current += 1;
    setLoading(true);
    await clearSavedMember();
    setMember(null);
    setCheckingSession(false);
    setMode("login");
    setLoading(false);
    authBusy.current = false;
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError("Enter your username or membership number and password.");
      return;
    }

    try {
      authBusy.current = true;
      sessionRequest.current += 1;
      setLoading(true);
      setSessionError("");
      await waitForMemberLogout();

      const response = await fetch("/api/member/auth/login", {
        method: "POST",
        credentials: "same-origin",
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
      returnToCard();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
      setCheckingSession(false);
      authBusy.current = false;
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setForgotMessage("");

    if (!forgotMemberNumber.trim() || !forgotEmail.trim()) {
      setError("Enter your membership number and registered email address.");
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
          memberNumber: forgotMemberNumber.trim(),
          email: forgotEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not send reset email.");
      }

      setForgotMessage(
        data.message ||
          "If those membership details are registered, we have sent a password reset link."
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

    if (!memberNumber.trim() || !username.trim()) {
      setError("Enter your member number and username.");
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
      authBusy.current = true;
      sessionRequest.current += 1;
      setLoading(true);
      setSessionError("");
      await waitForMemberLogout();

      const response = await fetch("/api/member/auth/register", {
        method: "POST",
        credentials: "same-origin",
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
      returnToCard();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setLoading(false);
      setCheckingSession(false);
      authBusy.current = false;
    }
  }

  if (checkingSession) {
    return (
      <section data-member-surface="member-account-light" className="rounded-[2rem] border border-zinc-200 bg-white p-6 text-zinc-950 shadow-sm" aria-live="polite">
        <RefreshCw className="animate-spin text-[#ff5a0a]" size={24} />
        <h1 className="mt-4 text-xl font-black">Checking your session…</h1>
        <p className="mt-2 text-sm font-bold text-zinc-500">Loading your member account securely.</p>
      </section>
    );
  }

  if (member) {
    return (
      <div data-member-surface="member-account-light" className="space-y-6 text-zinc-950">
        <section
          className="relative min-h-[330px] overflow-hidden rounded-[2.2rem] bg-cover bg-center p-6 shadow-xl"
          style={{ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(255,90,10,.22), rgba(0,0,0,.72)), url('/visuals/account.jpg')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/85" />
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
          <div className="relative flex min-h-[280px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a] backdrop-blur-md">Member Account</span>
              <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-14 w-14 object-contain drop-shadow-xl" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-[#ff5a0a]">Welcome back</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white">{member.fullName || member.username}</h1>
              <div className="mt-5 inline-flex items-center gap-3 rounded-[1.4rem] border border-white/15 bg-black/35 p-3 pr-5 backdrop-blur-md">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? "bg-[#ff5a0a] text-white" : "bg-red-500/20 text-red-100"}`}>
                  <BadgeCheck size={23} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Membership</p>
                  <p className={`mt-0.5 text-lg font-black ${active ? "text-white" : "text-red-100"}`}>{active ? "Active" : "Inactive / Expired"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><CreditCard size={24} strokeWidth={3} /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Membership Details</p><h2 className="mt-1 text-2xl font-black">Your BGM profile</h2></div>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><p className="text-xs font-black uppercase tracking-[.18em] text-zinc-400">Member Number</p><p className="mt-1 text-lg font-black">{member.memberNumber || "Not set"}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><p className="text-xs font-black uppercase tracking-[.18em] text-zinc-400">Email</p><p className="mt-1 break-all text-sm font-bold text-zinc-600">{member.email || "Not set"}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><p className="text-xs font-black uppercase tracking-[.18em] text-zinc-400">Valid Until</p><p className="mt-1 text-lg font-black">{formatDate(member.membershipExpiry)}</p></div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#ff5a0a]" size={25} strokeWidth={3} />
            <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">App Access</p><h2 className="mt-1 text-2xl font-black">Your app is activated</h2><p className="mt-3 text-sm font-bold leading-6 text-zinc-600">This device is linked to your BGM member account. Your passport, progress photos, trainer plan and app activity are saved against your profile.</p></div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><Smartphone size={24} strokeWidth={3} /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Member Tools</p><h2 className="mt-1 text-2xl font-black">Open your app tools</h2></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.href} href={item.href} className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 transition hover:bg-orange-50">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white"><Icon size={22} strokeWidth={3} /></div>
                  <h3 className="mt-4 text-lg font-black">{item.label}</h3>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">{item.description}</p>
                </a>
              );
            })}
          </div>
        </section>

        <button type="button" onClick={handleLogout} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-4 text-sm font-black text-red-700 disabled:opacity-60">
          <LogOut size={18} strokeWidth={3} />Logout
        </button>
      </div>
    );
  }

  return (
    <div data-member-surface="member-account-light" className="space-y-6 text-zinc-950">
      {sessionError && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          <p>{sessionError}</p>
          <button type="button" onClick={() => void checkSession()} className="mt-2 font-black underline">Check session again</button>
        </div>
      )}

      <section
        className="relative min-h-[300px] overflow-hidden rounded-[2.2rem] bg-cover bg-center p-6 shadow-xl"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(255,90,10,.22), rgba(0,0,0,.72)), url('/visuals/account.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/85" />
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
        <div className="relative flex min-h-[250px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a] backdrop-blur-md">BestGymsMalta</span>
            <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-14 w-14 object-contain drop-shadow-xl" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[.24em] text-[#ff5a0a]">Member Access</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">Your BGM account</h1>
            <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/65">Login or activate your app account using your BGM membership details.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        {mode !== "forgot" && (
          <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1">
            <button type="button" onClick={() => { setMode("login"); setError(""); }} className={`rounded-full px-5 py-3 text-sm font-black ${mode === "login" ? "bg-[#ff5a0a] text-white shadow-sm" : "text-zinc-500"}`}>Login</button>
            <button type="button" onClick={() => { setMode("activate"); setError(""); }} className={`rounded-full px-5 py-3 text-sm font-black ${mode === "activate" ? "bg-[#ff5a0a] text-white shadow-sm" : "text-zinc-500"}`}>Activate</button>
          </div>
        )}

        {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">{error}</div> : null}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-5 grid gap-4">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><Lock size={24} strokeWidth={3} /></div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Login</p><h2 className="mt-1 text-2xl font-black">Access your account</h2></div></div>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Username or Membership Number</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><User className="text-zinc-400" size={18} strokeWidth={3} /><input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} placeholder="Username or BGM0000001" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Password</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><KeyRound className="text-zinc-400" size={18} strokeWidth={3} /><input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Your password" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setForgotMessage(""); }} className="-mt-1 w-fit text-sm font-black text-[#ff5a0a]">Forgot password?</button>
            <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60">{loading ? <><RefreshCw size={17} strokeWidth={3} className="animate-spin" />Logging in…</> : <>Login<ChevronRight size={17} strokeWidth={3} /></>}</button>
          </form>
        ) : mode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="grid gap-4">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><Mail size={24} strokeWidth={3} /></div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Forgot Password</p><h2 className="mt-1 text-2xl font-black">Reset your password</h2></div></div>
            <p className="text-sm font-bold leading-6 text-zinc-500">Enter your permanent BGM membership number and registered email address. If those details match, we will send you a secure reset link.</p>
            {forgotMessage ? <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold leading-6 text-zinc-700">{forgotMessage}</div> : null}
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Membership Number</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><CreditCard className="text-zinc-400" size={18} strokeWidth={3} /><input value={forgotMemberNumber} onChange={(event) => setForgotMemberNumber(event.target.value)} placeholder="BGM0000001" autoCapitalize="characters" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Registered Email</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><Mail className="text-zinc-400" size={18} strokeWidth={3} /><input type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="Your membership email" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60">{loading ? <><RefreshCw size={17} strokeWidth={3} className="animate-spin" />Sending…</> : <>Send Reset Link<ChevronRight size={17} strokeWidth={3} /></>}</button>
            <button type="button" onClick={() => { setMode("login"); setError(""); setForgotMessage(""); }} className="rounded-full border border-zinc-200 bg-white px-5 py-4 text-sm font-black text-zinc-700">Back to Login</button>
          </form>
        ) : (
          <form onSubmit={handleActivate} className="mt-5 grid gap-4">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><ShieldCheck size={24} strokeWidth={3} /></div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#ff5a0a]">Activate</p><h2 className="mt-1 text-2xl font-black">Link your membership</h2></div></div>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Member Number</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><CreditCard className="text-zinc-400" size={18} strokeWidth={3} /><input value={memberNumber} onChange={(event) => setMemberNumber(event.target.value)} placeholder="Example: BGM0000001" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Registered Email (if available)</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><Mail className="text-zinc-400" size={18} strokeWidth={3} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your membership email" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Choose Username</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><User className="text-zinc-400" size={18} strokeWidth={3} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Create username" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Password</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><KeyRound className="text-zinc-400" size={18} strokeWidth={3} /><input type="password" value={activatePassword} onChange={(event) => setActivatePassword(event.target.value)} placeholder="Minimum 6 characters" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Confirm Password</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><KeyRound className="text-zinc-400" size={18} strokeWidth={3} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" className="w-full bg-transparent text-sm font-bold text-zinc-950 outline-none placeholder:text-zinc-400" /></div></label>
            <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60">{loading ? <><RefreshCw size={17} strokeWidth={3} className="animate-spin" />Activating…</> : <>Activate App<ChevronRight size={17} strokeWidth={3} /></>}</button>
            <p className="text-center text-xs font-bold leading-5 text-zinc-400">Your membership must first be added by BGM admin before activation works.</p>
          </form>
        )}
      </section>
    </div>
  );
}
