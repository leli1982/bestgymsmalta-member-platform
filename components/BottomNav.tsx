"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, QrCode, User, MapPinned } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/check-in", label: "Check In", icon: QrCode },
  { href: "/passport", label: "Explore", icon: MapPinned },
  { href: "/rewards", label: "Earn", icon: Gift },
  { href: "/profile", label: "You", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex w-[92%] max-w-md -translate-x-1/2 justify-around rounded-[2rem] border border-border bg-card/95 px-3 py-3 shadow-nav backdrop-blur">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-black transition active:scale-95 ${
              active
                ? "bg-primary text-black shadow-glow"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <Icon size={20} strokeWidth={3} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}