type GlassCardProps = {
  children: React.ReactNode;
  variant?: "default" | "hero" | "mission" | "compact";
  className?: string;
};

export default function GlassCard({
  children,
  variant = "default",
  className = "",
}: GlassCardProps) {
  const variants = {
    default: "p-5",
    hero: "p-6",
    mission: "p-5 border-orange-500/20 bg-orange-500/10",
    compact: "p-4",
  };

  return (
    <div
      className={`rounded-[2rem] border border-white/10 bg-white/[0.04] ${variants[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
