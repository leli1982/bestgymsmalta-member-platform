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
    mission: "p-5 border-[#fcb415]/20 bg-[#fcb415]/10",
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
