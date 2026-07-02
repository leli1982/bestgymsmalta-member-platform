import { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  text: string;
};

export default function FeatureCard({ icon, title, text }: FeatureCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950 p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
        {icon}
      </div>
      <h3 className="text-xl font-black uppercase">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}