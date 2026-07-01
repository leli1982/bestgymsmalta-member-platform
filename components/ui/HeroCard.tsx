import { ReactNode } from "react";

type HeroCardProps = {
  children: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  className?: string;
};

export default function HeroCard({
  children,
  imageSrc,
  imageAlt = "",
  className = "",
}: HeroCardProps) {
  return (
    <section
      className={`relative min-h-[430px] overflow-hidden rounded-[2rem] border border-orange-500/60 bg-zinc-950 p-6 shadow-[0_0_35px_rgba(249,115,22,0.25)] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_45%,rgba(249,115,22,0.55),transparent_38%)]" />

      {imageSrc && (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute bottom-0 right-0 h-full w-[58%] object-cover object-bottom opacity-90"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

      <div className="relative z-10">{children}</div>
    </section>
  );
}