import Link from "next/link";
import { Camera, CreditCard, Dumbbell, Home, MapPinned } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/card", label: "Card", icon: CreditCard },
  { href: "/passport", label: "Passport", icon: MapPinned },
  { href: "/gyms", label: "Gyms", icon: Dumbbell },
  { href: "/story", label: "Story", icon: Camera },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-black pb-28 text-white">
      <div className="mx-auto min-h-screen max-w-md px-5 py-6">
        {children}
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 flex w-[92%] max-w-md -translate-x-1/2 justify-around rounded-[2rem] border border-white/10 bg-zinc-950/95 px-3 py-3 shadow-2xl backdrop-blur">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-black text-zinc-500 transition hover:text-white active:scale-95"
            >
              <Icon size={20} strokeWidth={3} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
