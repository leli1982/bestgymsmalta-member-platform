import { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  variant?: "section" | "hero" | "compact" | "highlight";
};

export default function GlassPanel({
  children,
  className = "",
  variant = "section",
}: GlassPanelProps) {
  const variants = {
    section: "p-6",
    hero: "p-7 min-h-[260px]",
    compact: "p-4",
    highlight: "p-6 orange-halo",
  };

  return (
    <section className={`premium-surface ${variants[variant]} ${className}`}>
      <div className="relative z-10">{children}</div>
    </section>
  );
}