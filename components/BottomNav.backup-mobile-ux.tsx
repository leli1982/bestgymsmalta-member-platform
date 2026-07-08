"use client";

import {
  Bot,
  Camera,
  Home,
  MapPinned,
  Video,
} from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Gyms",
    href: "/gyms",
    icon: MapPinned,
  },
  {
    label: "Story",
    href: "/story",
    icon: Video,
  },
  {
    label: "Trainer",
    href: "/trainer",
    icon: Bot,
  },
  {
    label: "Progress",
    href: "/progress",
    icon: Camera,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/90 px-4 pb-4 pt-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-[2rem] border border-white/10 bg-zinc-950/95 p-2 shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2.5 text-[10px] font-black transition ${
                isActive
                  ? "bg-[#fcb415] text-black"
                  : "text-white/45 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon size={20} strokeWidth={3} />
              <span className="mt-1 truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
