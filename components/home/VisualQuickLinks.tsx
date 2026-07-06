"use client";

import {
  Bot,
  Camera,
  ChevronRight,
  Dumbbell,
  MapPinned,
  MessageCircle,
  Stamp,
  UserCircle,
  Video,
} from "lucide-react";

const quickLinks = [
  {
    label: "Gyms",
    href: "/gyms",
    icon: MapPinned,
    description: "Find locations",
    image: "/visuals/gyms.jpg",
  },
  {
    label: "Story",
    href: "/story",
    icon: Video,
    description: "Create & share",
    image: "/visuals/story.jpg",
  },
  {
    label: "Trainer",
    href: "/trainer",
    icon: Bot,
    description: "AI workout plan",
    image: "/visuals/trainer.jpg",
  },
  {
    label: "Progress",
    href: "/progress",
    icon: Camera,
    description: "Photo vault",
    image: "/visuals/progress.jpg",
  },
  {
    label: "Passport",
    href: "/passport",
    icon: Stamp,
    description: "Gym stamps",
    image: "/visuals/passport.jpg",
  },
  {
    label: "Account",
    href: "/member-login",
    icon: UserCircle,
    description: "Login & membership",
    image: "/visuals/account.jpg",
  },
  {
    label: "Contact",
    href: "https://m.me/bestgymsmalta",
    icon: MessageCircle,
    description: "Message BGM",
    image: "/visuals/contact.jpg",
    external: true,
  },
];

export default function VisualQuickLinks() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <Dumbbell className="text-[#fcb415]" size={25} strokeWidth={3} />

        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
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
              className={`group relative min-h-[150px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-cover bg-center p-4 shadow-xl transition hover:scale-[1.01] ${
                isLastOdd ? "col-span-2" : ""
              }`}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.84)), linear-gradient(135deg, rgba(252,180,21,.18), rgba(0,0,0,.72)), url('${item.image}')`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />

              <div className="relative flex h-full min-h-[118px] flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fcb415] text-black shadow-lg">
                    <Icon size={24} strokeWidth={3} />
                  </div>

                  <ChevronRight
                    className="text-white/45 transition group-hover:translate-x-1"
                    size={19}
                    strokeWidth={3}
                  />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white drop-shadow">
                    {item.label}
                  </h3>

                  <p className="mt-1 text-xs font-bold text-white/60">
                    {item.description}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
