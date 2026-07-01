"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

export default function MemberCard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="w-full text-left [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
        className="relative min-h-[250px] w-full [transform-style:preserve-3d]"
      >
        <CardFront />
        <CardBack />
      </motion.div>
    </button>
  );
}

function CardFront() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/10 bg-black p-6 shadow-[0_20px_70px_rgba(0,0,0,.65)] [backface-visibility:hidden]">
      <CardGlow />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <img
            src="/logos/bgm-main.png"
            alt="BestGymsMalta"
            className="w-24 object-contain"
          />

          <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            Premium
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-primary">
            Member
          </p>

          <h2 className="mt-3 text-4xl font-black uppercase italic leading-none">
            Leli
            <br />
            Apap
          </h2>

          <div className="mt-4 flex items-center gap-2 text-sm font-black uppercase text-white">
            <CheckCircle2 size={18} className="text-primary" />
            Active Member
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <MiniStat label="Score" value="86" />
          <MiniStat label="Points" value="1450" />
          <MiniStat label="Since" value="2024" />
        </div>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[32px] border border-white/10 bg-black p-6 shadow-[0_20px_70px_rgba(0,0,0,.65)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <CardGlow />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-primary">
              NFC Card
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase italic">
              Linked
            </h2>
          </div>

          <ShieldCheck size={42} className="text-primary" />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-black uppercase text-muted">Card ID</p>
          <p className="mt-2 text-2xl font-black uppercase tracking-wide">
            BGM-20491
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Home Gym" value="Pembroke" />
          <InfoBlock label="Status" value="Active" />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-muted">
          <CreditCard size={16} />
          Tap to flip back
        </div>
      </div>
    </div>
  );
}

function CardGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(249,115,22,.14),transparent_38%)]" />
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 font-black uppercase">{value}</p>
    </div>
  );
}