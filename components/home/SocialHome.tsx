"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Bot,
  Camera,
  ChevronRight,
  Dumbbell,
  MapPinned,
  MessageCircle,
  Sparkles,
  Stamp,
  UserCircle,
  Video,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";
import MemberCard from "@/components/member/MemberCard";
import ClosestGymCard from "@/components/home/ClosestGymCard";
import LiveUpdates from "@/components/home/LiveUpdates";

type QuickLink = {
  label: string;
  href: string;
  icon: typeof MapPinned;
  description: string;
  external?: boolean;
};

const quickLinks: QuickLink[] = [
  {
    label: "Gyms",
    href: "/gyms",
    icon: MapPinned,
    description: "Find locations",
  },
  {
    label: "Story",
    href: "/story",
    icon: Video,
    description: "Create & share",
  },
  {
    label: "Trainer",
    href: "/trainer",
    icon: Bot,
    description: "AI workout plan",
  },
  {
    label: "Progress",
    href: "/progress",
    icon: Camera,
    description: "Photo vault",
  },
  {
    label: "Passport",
    href: "/passport",
    icon: Stamp,
    description: "Gym stamps",
  },
  {
    label: "Account",
    href: "/member-login",
    icon: UserCircle,
    description: "Login & membership",
  },
  {
    label: "Contact",
    href: "https://m.me/bestgymsmalta",
    icon: MessageCircle,
    description: "Message BGM",
    external: true,
  },
];

export default function SocialHome() {
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

  const welcomeName =
    member?.username || member?.fullName?.split(" ")[0] || "Member";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-6 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
                BestGymsMalta
              </p>

              <h1 className="mt-3 text-4xl font-black leading-tight text-white">
                Welcome back, {welcomeName}
              </h1>

              <p className="mt-4 text-sm font-bold leading-6 text-white/55">
                Your membership card, gyms, trainer, stories and progress tools
                in one place.
              </p>
            </div>

            <div className="relative h-20 w-24 shrink-0">
              <Image
                src="/bgm-logo.png"
                alt="BestGymsMalta"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <ClosestGymCard />

      <MemberCard />

      <LiveUpdates />

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <Dumbbell className="text-orange-500" size={25} strokeWidth={3} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Quick Links
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              Open your tools
            </h2>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {quickLinks.map((item, index) => {
            const Icon = item.icon;
            const isLastOdd =
              quickLinks.length % 2 === 1 && index === quickLinks.length - 1;

            return (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                className={`rounded-[1.5rem] border border-white/10 bg-black/25 p-4 transition hover:bg-white/[0.06] ${
                  isLastOdd ? "col-span-2" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                    <Icon size={24} strokeWidth={3} />
                  </div>

                  <ChevronRight
                    className="text-white/25"
                    size={18}
                    strokeWidth={3}
                  />
                </div>

                <h3 className="mt-4 text-lg font-black text-white">
                  {item.label}
                </h3>

                <p className="mt-1 text-xs font-bold text-white/40">
                  {item.description}
                </p>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="rounded-[2rem] border border-white/10 bg-black/25 p-6 text-center">
        <Sparkles className="mx-auto text-orange-500" size={30} strokeWidth={3} />

        <p className="mt-4 text-xs font-black uppercase tracking-[.25em] text-orange-500">
          Be the best... Beat the rest
        </p>

        <p className="mt-2 text-sm font-bold text-white/40">
          BestGymsMalta member app
        </p>
      </footer>
    </div>
  );
}
