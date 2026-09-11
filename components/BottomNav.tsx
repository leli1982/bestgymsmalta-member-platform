"use client";

import {
  Bot,
  Camera,
  Dumbbell,
  Home,
  MapPinned,
  UserCircle,
  Users,
  Video,
} from "lucide-react";
import { usePathname } from "next/navigation";

type BottomNavProps = {
  variant?: "dark" | "light";
};

const darkNavItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Gyms", href: "/gyms", icon: MapPinned },
  { label: "Story", href: "/story", icon: Video },
  { label: "Trainer", href: "/trainer", icon: Bot },
  { label: "Progress", href: "/progress", icon: Camera },
];

const approvedHomeNavItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Gyms", href: "/gyms", icon: MapPinned },
  { label: "Workouts", href: "/trainer", icon: Dumbbell },
  { label: "Community", href: "/member-showcase", icon: Users },
  { label: "Profile", href: "/member-login", icon: UserCircle },
];

export default function BottomNav({ variant = "dark" }: BottomNavProps) {
  const pathname = usePathname();
  const isLight = variant === "light";
  const navItems = isLight ? approvedHomeNavItems : darkNavItems;

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 border-t pb-[calc(.65rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl ${
        isLight ? "border-zinc-200 bg-white/98" : "border-white/10 bg-black/90 px-4"
      }`}
    >
      <div
        className={`mx-auto flex max-w-md items-stretch justify-between ${
          isLight ? "px-2" : "gap-2 rounded-[2rem] border border-white/10 bg-zinc-950/95 p-2 shadow-2xl"
        }`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          if (isLight) {
            return (
              <a
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1.5 text-[10px] font-bold transition ${
                  isActive ? "text-[#ff5a0a]" : "text-slate-500 hover:text-zinc-950"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 3 : 2.4} />
                <span className="mt-1 truncate">{item.label}</span>
                {isActive ? <span className="absolute -bottom-1 h-[3px] w-9 rounded-full bg-[#ff5a0a]" /> : null}
              </a>
            );
          }

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
