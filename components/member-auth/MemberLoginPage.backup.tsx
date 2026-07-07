"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import {
  clearSavedMember,
  getSavedMember,
  saveMember,
  type AppMember,
} from "@/lib/memberSession";

export default function MemberLoginPage() {
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [member, setMember] = useState<AppMember | null>(null);
  const [status, setStatus] = useState("");

  const [login, setLogin] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [memberNumber, setMemberNumber] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [activatePassword, setActivatePassword] = useState("");

  useEffect(() => {
    setMember(getSavedMember());
  }, []);

  async function handleLogin() {
    setStatus("Logging in…");

    const response = await fetch("/api/member/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login,
        password: loginPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Login failed.");
      return;
    }

    saveMember(data.member);
    setMember(data.member);
    setStatus("Logged in.");
  }

  async function handleActivate() {
    setStatus("Activating account…");

    const response = await fetch("/api/member/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        memberNumber,
        email,
        username,
        password: activatePassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error || "Activation failed.");
      return;
    }

    saveMember(data.member);
    setMember(data.member);
    setStatus("Account activated and logged in.");
  }

  function logout() {
    clearSavedMember();
    setMember(null);
    setStatus("Logged out.");
  }

  if (member) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
          Member Login
        </p>

        <h1 className="mt-4 text-4xl font-black text-white">
          You are logged in
        </h1>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-lg font-black text-white">{member.fullName}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
            {member.memberNumber}
          </p>
          <p className="mt-2 text-sm font-bold text-white/45">
            {member.email}
          </p>
          {member.membershipExpiry ? (
            <p className="mt-2 text-sm font-bold text-white/45">
              Expiry: {member.membershipExpiry}
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/passport"
            className="flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Passport
          </a>

          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
          >
            <LogOut size={17} strokeWidth={3} />
            Logout
          </button>
        </div>

        {status ? (
          <p className="mt-4 text-center text-sm font-bold text-white/50">
            {status}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
        BestGymsMalta
      </p>

      <h1 className="mt-4 text-4xl font-black text-white">
        Member Login
      </h1>

      <p className="mt-3 text-sm font-bold leading-6 text-white/50">
        Log in to access your passport, check-ins, stats and member features.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-full px-5 py-3 text-sm font-black ${
            mode === "login"
              ? "bg-[#fcb415] text-black"
              : "border border-white/10 bg-white/[0.04] text-white"
          }`}
        >
          Login
        </button>

        <button
          type="button"
          onClick={() => setMode("activate")}
          className={`rounded-full px-5 py-3 text-sm font-black ${
            mode === "activate"
              ? "bg-[#fcb415] text-black"
              : "border border-white/10 bg-white/[0.04] text-white"
          }`}
        >
          Activate
        </button>
      </div>

      {mode === "login" ? (
        <div className="mt-5 grid gap-3">
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="Username, email or member number"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            placeholder="Password"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={handleLogin}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            <LogIn size={17} strokeWidth={3} />
            Login
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          <input
            value={memberNumber}
            onChange={(event) =>
              setMemberNumber(event.target.value.toUpperCase())
            }
            placeholder="Member number"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email used with your membership"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose username"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <input
            type="password"
            value={activatePassword}
            onChange={(event) => setActivatePassword(event.target.value)}
            placeholder="Choose password"
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm font-bold text-white outline-none"
          />

          <button
            type="button"
            onClick={handleActivate}
            className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            <UserPlus size={17} strokeWidth={3} />
            Activate App Account
          </button>
        </div>
      )}

      {status ? (
        <p className="mt-4 text-center text-sm font-bold text-white/50">
          {status}
        </p>
      ) : null}
    </section>
  );
}
