"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { getMemberDisplayName, setMemberDisplayName, MAX_DISPLAY_NAME_LENGTH } from "@/lib/memberDisplayName";

export default function MemberDisplayNameSettings() {
  const [memberId, setMemberId] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/member/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Please sign in again to edit your display name.");
        const data = await response.json();
        if (!data.member?.id) throw new Error("Member account unavailable.");
        if (!mounted) return;
        setMemberId(data.member.id);
        setOfficialName(data.member.fullName?.trim().split(/\s+/)[0] || data.member.username || "Member");
        setName(getMemberDisplayName(data.member.id));
      })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "Could not load your profile."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function save(value: string) {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/member/auth/session", { credentials: "same-origin", cache: "no-store" });
      const data = response.ok ? await response.json() : null;
      if (!memberId || data?.member?.id !== memberId) throw new Error("Your session changed. Please reopen Account Settings.");
      const saved = setMemberDisplayName(memberId, value);
      setName(saved);
      setNotice(saved ? "Display name saved." : "Original greeting restored.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your display name.");
    } finally { setSaving(false); }
  }

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm" aria-labelledby="member-display-name-title">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#805600]"><UserRound size={23} strokeWidth={2.5} /></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">Personalise your app</p>
          <h2 id="member-display-name-title" className="mt-1 text-xl font-black text-zinc-950">Display name</h2>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">Choose what the home screen calls you. This only changes your greeting on this device, not your membership name or login username.</p>
      <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void save(name); }}>
        <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-zinc-500">
          Preferred name
          <input type="text" autoComplete="nickname" value={name} onChange={(event) => { setName(event.target.value); setNotice(""); setError(""); }}
            disabled={loading || saving || !memberId} maxLength={MAX_DISPLAY_NAME_LENGTH}
            placeholder={officialName || "Your preferred name"} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold normal-case tracking-normal text-zinc-950 outline-none focus:border-[#ffb400]" />
        </label>
        {memberId && <p className="break-words rounded-xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white">Welcome back, <span className="text-[#ffb400]">{name.trim() || officialName}</span></p>}
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm font-bold text-emerald-700">{notice}</p>}
        <button type="submit" disabled={loading || saving || !memberId} className="rounded-full bg-[#ffb400] px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50">{saving ? "Saving…" : "Save Display Name"}</button>
        <button type="button" disabled={loading || saving || !memberId} onClick={() => void save("")} className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-700 disabled:opacity-50">Restore original name</button>
      </form>
    </section>
  );
}
