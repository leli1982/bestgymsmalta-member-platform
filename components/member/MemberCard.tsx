"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CalendarDays,
  CreditCard,
  Dumbbell,
  MapPinned,
  RotateCcw,
  ShieldCheck,
  SmartphoneNfc,
} from "lucide-react";
import { currentMember } from "@/components/data/member";

function formatStatus(status: string) {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return "Expired";
}

function CardDetail({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

export default function MemberCard() {
  const [flipped, setFlipped] = useState(false);
  const status = formatStatus(currentMember.status);

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setFlipped((current) => !current)}
        className="group block w-full text-left [perspective:1200px]"
        aria-label="Flip membership card"
      >
        <div
          className="relative aspect-[16/10] w-full transition-transform duration-700 [transform-style:preserve-3d]"
          style={{
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[2rem] border border-orange-500/25 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-6 shadow-2xl [backface-visibility:hidden]"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="absolute -bottom-20 left-8 h-52 w-52 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="relative h-20 w-32">
                  <Image
                    src="/bgm-logo.png"
                    alt="BestGymsMalta"
                    fill
                    priority
                    className="object-contain object-left"
                  />
                </div>

                <div className="rounded-full border border-green-400/30 bg-green-400/10 px-4 py-2">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-green-300">
                    {status}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[.28em] text-orange-500">
                  Digital Membership Card
                </p>

                <h2 className="mt-2 text-3xl font-black leading-none text-white">
                  {currentMember.fullName}
                </h2>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                      Member No.
                    </p>
                    <p className="mt-1 text-xl font-black text-white">
                      {currentMember.membershipNumber}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-orange-500">
                    <SmartphoneNfc size={28} strokeWidth={3} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[2rem] border border-orange-500/25 bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-6 shadow-2xl [backface-visibility:hidden]"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="absolute -bottom-24 right-4 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.28em] text-orange-500">
                    Card Details
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    {currentMember.membershipLabel}
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-orange-500">
                  <ShieldCheck size={26} strokeWidth={3} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CardDetail label="NFC Card" value={currentMember.nfcCard.status} />
                <CardDetail label="Since" value={currentMember.memberSince} />
                <CardDetail
                  label="Passport"
                  value={`${currentMember.passport.gymsVisited}/${currentMember.passport.totalGyms}`}
                />
                <CardDetail
                  label="Goal"
                  value={`${currentMember.fitness.currentGoal.progress}%`}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                  Be the best.... Beat the rest
                </p>
                <p className="mt-2 text-sm font-bold leading-5 text-white/55">
                  Show this digital card when needed. NFC-ready membership
                  access is prepared for future rollout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.2em] text-white/35">
        <RotateCcw size={15} strokeWidth={3} />
        Tap card to flip
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="/passport"
          className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black transition active:scale-95"
        >
          <MapPinned size={18} strokeWidth={3} />
          Open Passport
        </a>

        <a
          href="/goals"
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white transition active:scale-95"
        >
          <Dumbbell size={18} strokeWidth={3} />
          Fitness Goals
        </a>
      </div>
    </section>
  );
}
