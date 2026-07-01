import Link from "next/link";
import { Dumbbell, Gift, Home, QrCode, Trophy } from "lucide-react";
import { LogoLockup } from "./Brand";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/check-in", label: "Check In", icon: QrCode },
  { href: "/passport", label: "Passport", icon: Trophy },
  { href: "/rewards", label: "Rewards", icon: Gift },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg bg-grid bg-[length:42px_42px] pb-28 text-white">
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_top_right,rgba(215,255,56,.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,49,49,.12),transparent_35%)]" />
      <div className="relative z-10 mx-auto max-w-5xl px-5 py-6">
        <header className="mb-8 flex items-center justify-between">
          <LogoLockup />
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-acid">
            1,450 pts
          </div>
        </header>
        {children}
      </div>
      <nav className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-3xl border border-white/10 bg-black/80 p-2 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-acid">
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5 shadow-2xl backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-semibold text-white/55">{detail}</p>
    </div>
  );
}

export function PrimaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-acid px-6 py-4 text-base font-black uppercase tracking-wide text-black shadow-glow transition hover:scale-[1.02]">
      {children}
    </Link>
  );
}

export function SecondaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-black uppercase tracking-wide text-white transition hover:bg-white/10">
      {children}
    </Link>
  );
}

export function GymBadge({ short, name, visited }: { short: string; name: string; visited: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${visited ? "border-acid/40 bg-acid/10" : "border-white/10 bg-white/[.04]"}`}>
      <div className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-black ${visited ? "bg-acid text-black" : "bg-white/10 text-white/40"}`}>
        {short}
      </div>
      <p className="mt-4 text-sm font-black">{name}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-white/40">{visited ? "Unlocked" : "Not visited"}</p>
    </div>
  );
}
