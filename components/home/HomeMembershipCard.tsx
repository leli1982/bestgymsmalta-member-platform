"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, LogIn, ShieldCheck } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

export default function HomeMembershipCard() {
  const [member, setMember] = useState<AppMember | null>(null);

  useEffect(() => {
    function loadMember() {
      setMember(getSavedMember());
    }

    loadMember();

    window.addEventListener("bgmMemberChanged", loadMember);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadMember);
    };
  }, []);

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-orange-500/30 bg-orange-500/10 p-5">
        <div className="flex items-center gap-3">
          <CreditCard className="text-orange-500" size={26} strokeWidth={3} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Membership Card
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Login to show your card
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm font-bold leading-6 text-white/55">
          Your digital membership card will appear here as soon as you log in.
        </p>

        <a
          href="/member-login"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          <LogIn size={17} strokeWidth={3} />
          Login / Activate
        </a>
      </section>
    );
  }

  const expiryText = member.membershipExpiry
    ? new Date(member.membershipExpiry).toLocaleDateString()
    : "Active member";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-orange-500/35 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 shadow-2xl">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-orange-500/25 blur-3xl" />
      <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Digital Membership Card
            </p>

            <h2 className="mt-3 text-3xl font-black leading-tight text-white">
              {member.fullName || member.username}
            </h2>

            <p className="mt-2 text-sm font-black uppercase tracking-[.18em] text-white/45">
              {member.memberNumber}
            </p>
          </div>

          <div className="relative h-16 w-20 shrink-0">
            <Image
              src="/bgm-logo.png"
              alt="BestGymsMalta"
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex items-center gap-2">
              <BadgeCheck className="text-green-300" size={20} strokeWidth={3} />
              <p className="text-xs font-black uppercase tracking-[.16em] text-green-300">
                {member.status || "Active"}
              </p>
            </div>
            <p className="mt-2 text-xs font-bold text-white/45">
              Membership status
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-orange-500" size={20} strokeWidth={3} />
              <p className="text-xs font-black uppercase tracking-[.16em] text-white">
                Valid
              </p>
            </div>
            <p className="mt-2 text-xs font-bold text-white/45">
              Until {expiryText}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
          <p className="text-xs font-bold leading-5 text-white/60">
            Show this card at reception when needed. Your passport and check-ins
            are connected to this member account.
          </p>
        </div>
      </div>
    </section>
  );
}
