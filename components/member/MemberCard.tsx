"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, LogIn, ShieldCheck } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

function NfcMark() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-[#fcb415]"
      >
        <path
          d="M7 8.5C8.8 10.3 8.8 13.7 7 15.5"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M10.5 6C13.7 9.2 13.7 14.8 10.5 18"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M14 3.5C18.9 8.4 18.9 15.6 14 20.5"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </svg>

      <span className="text-[10px] font-black uppercase tracking-[.2em] text-white/60">
        NFC
      </span>
    </div>
  );
}

export default function MemberCard() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [flipped, setFlipped] = useState(false);

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
        className="relative min-h-[285px] transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT */}
        <section
          className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[#fcb415]/35 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 shadow-2xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#fcb415]/25 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[#fcb415]/10 blur-3xl" />
          <div className="absolute bottom-5 right-5 opacity-10">
            <CreditCard size={120} strokeWidth={1.5} />
          </div>

          <div className="relative flex min-h-[245px] flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  BestGymsMalta
                </p>

                <h2 className="mt-4 text-3xl font-black leading-tight text-white">
                  {member.fullName || member.username}
                </h2>

                <p className="mt-2 text-sm font-black uppercase tracking-[.18em] text-white/45">
                  Member No. {member.memberNumber}
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

            <div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck
                      className="text-green-300"
                      size={21}
                      strokeWidth={3}
                    />
                    <p className="text-xs font-black uppercase tracking-[.16em] text-green-300">
                      {member.status || "Active"}
                    </p>
                  </div>

                  <p className="mt-2 text-xs font-bold text-white/45">
                    Valid until {expiryText}
                  </p>
                </div>

                <NfcMark />
              </div>

              <p className="mt-5 text-center text-[10px] font-black uppercase tracking-[.22em] text-white/30">
                Tap card to flip
              </p>
            </div>
          </div>
        </section>

        {/* BACK */}
        <section
          className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[#fcb415]/35 bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-5 shadow-2xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[#fcb415]/20 blur-3xl" />
          <div className="absolute -bottom-20 right-8 h-44 w-44 rounded-full bg-[#fcb415]/10 blur-3xl" />

          <div className="relative flex min-h-[245px] flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  Member Details
                </p>

                <NfcMark />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                    Name
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {member.fullName || member.username}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                    Member Number
                  </p>
                  <p className="mt-2 text-xl font-black text-[#fcb415]">
                    {member.memberNumber}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className="text-[#fcb415]"
                        size={19}
                        strokeWidth={3}
                      />
                      <p className="text-xs font-black uppercase tracking-[.16em] text-white">
                        Valid
                      </p>
                    </div>
                    <p className="mt-2 text-xs font-bold text-white/45">
                      {expiryText}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                      Email
                    </p>
                    <p className="mt-2 truncate text-xs font-bold text-white/60">
                      {member.email}
                    </p>
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
