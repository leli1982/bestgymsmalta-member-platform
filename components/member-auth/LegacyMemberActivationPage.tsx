"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, CreditCard, KeyRound, Mail, RefreshCw, ShieldCheck, Smartphone, User } from "lucide-react";
import EuropeanDateInput from "@/components/ui/EuropeanDateInput";
import { saveMember } from "@/lib/memberSession";

export default function LegacyMemberActivationPage() {
  const [legacyPk, setLegacyPk] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobile, setMobile] = useState("");
  const [needsIdentityCheck, setNeedsIdentityCheck] = useState(false);
  const [recoveredMemberNumber, setRecoveredMemberNumber] = useState("");
  const [emailUpdated, setEmailUpdated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!legacyPk.trim() || !email.trim() || !username.trim()) {
      setError("Enter your old membership number, email and chosen username.");
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
    if (needsIdentityCheck && (!dateOfBirth || !mobile.trim())) {
      setError("Enter the member's date of birth and mobile number to continue.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/member/auth/legacy-register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legacyPk: legacyPk.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
          dateOfBirth,
          mobile: mobile.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.needsIdentityCheck) {
          setNeedsIdentityCheck(true);
          setError("");
          return;
        }
        throw new Error(data?.error || "Activation failed.");
      }

      const activatedMember = data.member || data;
      saveMember(activatedMember);
      setRecoveredMemberNumber(String(data.recoveredMemberNumber || activatedMember.memberNumber || ""));
      setEmailUpdated(Boolean(data.emailUpdated));
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  if (recoveredMemberNumber) {
    return (
      <div className="space-y-5 text-zinc-950">
        <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <CheckCircle2 className="text-emerald-600" size={42} strokeWidth={3} />
          <p className="mt-4 text-xs font-black uppercase tracking-[.22em] text-emerald-700">Membership found</p>
          <h1 className="mt-2 text-3xl font-black">Your app is activated</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">Your permanent BestGymsMalta member number is:</p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-5 text-center">
            <p className="text-3xl font-black tracking-wide">{recoveredMemberNumber}</p>
          </div>
          {emailUpdated ? (
            <p className="mt-4 text-sm font-bold leading-6 text-emerald-800">Your new email address has also been saved to your membership record.</p>
          ) : null}
        </section>
        <a href="/card" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100">
          Continue to Member App <ChevronRight size={17} strokeWidth={3} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-zinc-950">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><ShieldCheck size={24} strokeWidth={3} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a0a]">Existing Members</p>
            <h1 className="mt-1 text-2xl font-black">Activate with your old membership number</h1>
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">Use this if you were already a BGM member before the new app and do not know your new BGM number.</p>
          </div>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">{error}</div> : null}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Old Membership / PK Number</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><CreditCard className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Old Membership / PK Number" value={legacyPk} onChange={(event) => setLegacyPk(event.target.value)} placeholder="Your old membership number" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>
          <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Email Address</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><Mail className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Legacy activation email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>

          {needsIdentityCheck ? (
            <div className="grid gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-black leading-6 text-orange-900">This old membership has no email saved. Confirm these details and we will save the email above to your membership record.</p>
              <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Date of Birth</span><EuropeanDateInput ariaLabel="Legacy member date of birth" value={dateOfBirth} onValueChange={setDateOfBirth} className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold outline-none" /></label>
              <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Mobile Number</span><div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-white px-4 py-3"><Smartphone className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Legacy member mobile number" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number on your old record" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>
            </div>
          ) : null}

          <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Choose Username</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><User className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Legacy activation username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Create username" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>
          <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Password</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><KeyRound className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Legacy activation password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 characters" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>
          <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[.18em] text-zinc-500">Confirm Password</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"><KeyRound className="text-zinc-400" size={18} strokeWidth={3} /><input aria-label="Confirm legacy activation password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400" /></div></label>

          <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 disabled:opacity-60">{loading ? <><RefreshCw size={17} strokeWidth={3} className="animate-spin" />Checking…</> : <>Activate My App<ChevronRight size={17} strokeWidth={3} /></>}</button>
        </form>
      </section>

      <a href="/member-login" className="block text-center text-sm font-black text-[#ff5a0a]">Back to normal login / activation</a>
    </div>
  );
}
