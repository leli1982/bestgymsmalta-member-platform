"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  CreditCard,
  Home,
  MapPinned,
  MessageCircle,
  Stamp,
} from "lucide-react";

const FACEBOOK_MESSENGER_URL = "https://m.me/bestgymsmalta";

const navItems = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Card",
    href: "/card",
    icon: CreditCard,
  },
  {
    label: "Passport",
    href: "/passport",
    icon: Stamp,
  },
  {
    label: "Gyms",
    href: "/gyms",
    icon: MapPinned,
  },
  {
    label: "Story",
    href: "/story",
    icon: Camera,
  },
  {
    label: "Contact",
    href: FACEBOOK_MESSENGER_URL,
    icon: MessageCircle,
    external: true,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            !item.external &&
            (item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href));

          const className = `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-black transition ${
            active
              ? "bg-orange-500 text-black"
              : "text-white/45 active:bg-white/10 active:text-white"
          }`;

          if (item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                <Icon size={19} strokeWidth={3} />
                <span>{item.label}</span>
              </a>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={className}>
              <Icon size={19} strokeWidth={3} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
