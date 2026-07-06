import Link from "next/link";
import { ReactNode } from "react";

type QuickActionCardProps = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
};

export default function QuickActionCard({
  href,
  icon,
  title,
  subtitle,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.055] p-4 text-center shadow-[0_12px_35px_rgba(0,0,0,.45)] backdrop-blur-xl transition active:scale-95"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/15 blur-2xl transition group-hover:bg-primary/25" />

      <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-[0_0_22px_rgba(252,180,21,.18)]">
        {icon}
      </div>

      <h3 className="relative z-10 mt-4 text-sm font-black uppercase leading-none">
        {title}
      </h3>

      <p className="relative z-10 mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {subtitle}
      </p>
    </Link>
  );
}