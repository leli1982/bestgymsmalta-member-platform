"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CreditCard, LogIn, ShieldCheck } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";
import MemberBarcode from "@/components/member/MemberBarcode";

type CardCredential = {
  cardLinked: boolean;
  cardBarcode: string | null;
  source: "credential" | "legacy" | null;
};

export default function MemberCard() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [cardLinked, setCardLinked] = useState<boolean | null>(null);
  const [cardBarcode, setCardBarcode] = useState("");
  const [cardError, setCardError] = useState("");

  const loadCardCredential = useCallback(async () => {
    setCardError("");
    try {
      const response = await fetch("/api/member/card", { cache: "no-store" });
      const data = (await response.json()) as CardCredential & { error?: string };
      if (!response.ok) {
        setCardLinked(false);
        setCardBarcode("");
        setCardError(data.error || "Could not load your current card.");
        return;
      }
      setCardLinked(data.cardLinked === true);
      setCardBarcode(data.cardLinked && data.cardBarcode ? data.cardBarcode : "");
    } catch {
      setCardLinked(false);
      setCardBarcode("");
      setCardError("Could not load your current card.");
    }
  }, []);

  useEffect(() => {
    function loadMember() {
      const nextMember = getSavedMember();
      setMember(nextMember);
      setCardLinked(nextMember ? null : false);
      setCardBarcode("");
      if (nextMember) void loadCardCredential();
    }

    function refreshOnFocus() {
      if (getSavedMember()) void loadCardCredential();
    }

    loadMember();
    window.addEventListener("bgmMemberChanged", loadMember);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadMember);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadCardCredential]);

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5">
        <div className="flex items-center gap-3">
          <CreditCard className="text-[#fcb415]" size={26} strokeWidth={3} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Digital Membership Card
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Login to show your card
            </h2>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-white/55">
          Your digital membership card appears here when you log in.
        </p>
        <a
          href="/member-login"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
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
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      className="block w-full text-left"
      style={{ perspective: "1200px" }}
      aria-label="Flip membership card"
    >
      <div
        className="relative min-h-[390px] transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <section
          className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[#fcb415]/35 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 shadow-2xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#fcb415]/25 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[#fcb415]/10 blur-3xl" />
          <div className="absolute bottom-5 right-5 opacity-10">
            <CreditCard size={120} strokeWidth={1.5} />
          </div>

          <div className="relative flex min-h-[350px] flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                    BestGymsMalta
                  </p>
                  <h2 className="mt-4 text-3xl font-black leading-tight text-white">
                    {member.fullName || member.username}
                  </h2>
                  <p className="mt-2 text-sm font-black uppercase tracking-[.18em] text-white/45">
                    {cardLinked && cardBarcode ? `Card No. ${cardBarcode}` : "Card not linked"}
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

              <div className="mt-5">
                {cardLinked === null ? (
                  <div className="rounded-xl bg-white/10 p-5 text-center text-sm font-bold text-white/55">
                    Refreshing current card…
                  </div>
                ) : cardLinked && cardBarcode ? (
                  <MemberBarcode memberNumber={cardBarcode} />
                ) : (
                  <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-5 text-center">
                    <p className="text-lg font-black text-amber-300">CARD NOT LINKED</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-white/55">
                      Visit reception so your physical BGM card can be linked before using virtual access.
                    </p>
                  </div>
                )}
                {cardError && (
                  <p className="mt-2 text-center text-xs font-bold text-red-300">{cardError}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="text-green-300" size={21} strokeWidth={3} />
                <p className="text-xs font-black uppercase tracking-[.16em] text-green-300">
                  {member.status || "Active"}
                </p>
              </div>
              <p className="mt-2 text-xs font-bold text-white/45">
                Valid until {expiryText}
              </p>
              <p className="mt-4 text-center text-[10px] font-black uppercase tracking-[.22em] text-white/30">
                Tap card to flip
              </p>
            </div>
          </div>
        </section>

        <section
          className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[#fcb415]/35 bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-5 shadow-2xl"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#fcb415]/20 blur-3xl" />
          <div className="relative flex min-h-[350px] flex-col justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Member Details
              </p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">Name</p>
                  <p className="mt-2 text-lg font-black text-white">{member.fullName || member.username}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">Current Card Number</p>
                  <p className="mt-2 break-all text-xl font-black text-[#fcb415]">
                    {cardLinked && cardBarcode ? cardBarcode : "Not linked"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="text-[#fcb415]" size={19} strokeWidth={3} />
                      <p className="text-xs font-black uppercase tracking-[.16em] text-white">Valid</p>
                    </div>
                    <p className="mt-2 text-xs font-bold text-white/45">{expiryText}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">Email</p>
                    <p className="mt-2 truncate text-xs font-bold text-white/60">{member.email}</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-[10px] font-black uppercase tracking-[.22em] text-white/30">
              Tap card to return
            </p>
          </div>
        </section>
      </div>
    </button>
  );
}
