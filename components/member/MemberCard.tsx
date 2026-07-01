"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, ShieldCheck, Wifi } from "lucide-react";

import { currentMember } from "@/components/data/member";
import { getGymById } from "@/components/data/gyms";

export default function MemberCard() {
  const [flipped, setFlipped] = useState(false);
  const homeGym = getGymById(currentMember.homeGymId);

  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="w-full text-left [perspective:1400px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          rotateY: flipped ? 180 : 0,
        }}
        whileHover={{
          y: -6,
          rotateX: 2,
          rotateZ: -1,
        }}
        whileTap={{
          scale: 0.985,
        }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-[1.586/1] w-full [transform-style:preserve-3d]"
      >
        <CardFront />
        <CardBack homeGym={homeGym?.shortName ?? "Pembroke"} />
      </motion.div>
    </button>
  );
}

function CardFront() {
  const tier = currentMember.tier.toUpperCase();
  const status = currentMember.status.toUpperCase();

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[34px] bg-[#050505] p-7 shadow-[0_28px_90px_rgba(0,0,0,.75)] ring-1 ring-white/10 [backface-visibility:hidden]">
      <LuxuryCardEffects />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <img
            src="/logos/bgm-main.png"
            alt="BestGymsMalta"
            className="h-16 w-auto object-contain drop-shadow-[0_0_18px_rgba(249,115,22,0.25)]"
          />

          <div className="flex items-center gap-2 text-primary">
            <Wifi size={24} />
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(249,115,22,.9)]" />
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-primary">
              {status}
            </p>
          </div>

          <p className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-500">
            Member
          </p>

          <h2 className="mt-3 text-4xl font-black uppercase italic leading-[0.9] tracking-tight">
            {currentMember.firstName}
            <br />
            {currentMember.lastName}
          </h2>
        </div>

        <div className="flex items-end justify-between border-t border-white/10 pt-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
              Tier
            </p>
            <p className="mt-1 text-sm font-black uppercase tracking-[0.25em] text-white">
              {tier}
            </p>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-600">
            Tap to flip
          </p>
        </div>
      </div>
    </div>
  );
}

function CardBack({ homeGym }: { homeGym: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[34px] bg-[#050505] p-7 shadow-[0_28px_90px_rgba(0,0,0,.75)] ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <LuxuryCardEffects />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.45em] text-primary">
              NFC Card
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase italic leading-none">
              Linked
            </h2>
          </div>

          <ShieldCheck size={42} className="text-primary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Card ID" value={currentMember.nfcCard.cardId} />
          <InfoBlock label="Home Gym" value={homeGym} />
          <InfoBlock
            label="Fitness Score"
            value={currentMember.fitnessScore.toString()}
          />
          <InfoBlock
            label="Points"
            value={currentMember.points.toLocaleString()}
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">
            <CreditCard size={15} />
            Member Since {currentMember.memberSince}
          </div>

          <CheckCircle2 size={18} className="text-primary" />
        </div>
      </div>
    </div>
  );
}

function LuxuryCardEffects() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(249,115,22,.18),transparent_34%)]" />
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-white/[0.03] blur-3xl" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <motion.div
        className="pointer-events-none absolute inset-0 rotate-12 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
        initial={{ x: "-140%" }}
        animate={{ x: "140%" }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          repeatDelay: 4,
          ease: "easeInOut",
        }}
      />
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-white/[0.045] p-4 ring-1 ring-white/10">
      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">
        {label}
      </p>

      <p className="mt-2 truncate text-sm font-black uppercase text-white">
        {value}
      </p>
    </div>
  );
}