import { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "hero" | "mission" | "reward";
};

export default function GlassCard({
  children,
  className = "",
  variant = "default",
}: GlassCardProps) {
  const variants = {
    default: "p-6",
    hero: "p-7 min-h-[220px]",
    mission: "p-6",
    reward: "p-5",
  };

  return (
    <div
      className={`
        group relative overflow-hidden rounded-[32px]
        border border-white/10
        bg-white/[0.055]
        shadow-[0_18px_60px_rgba(0,0,0,.55)]
        backdrop-blur-2xl
        ${variants[variant]}
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl transition duration-700 group-hover:bg-primary/25" />

      <div className="pointer-events-none absolute -left-24 bottom-0 h-52 w-52 rounded-full bg-primary/5 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-primary/10" />

      <div className="pointer-events-none absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/8 to-transparent opacity-0 transition duration-1000 group-hover:translate-x-[120%] group-hover:opacity-100" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}