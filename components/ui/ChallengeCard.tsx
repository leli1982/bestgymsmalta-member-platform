import { Trophy } from "lucide-react";

type ChallengeCardProps = {
  title: string;
  description: string;
  points: string;
};

export default function ChallengeCard({
  title,
  description,
  points,
}: ChallengeCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-orange-500/40 bg-gradient-to-br from-orange-500/15 to-zinc-950 p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-black">
        <Trophy size={24} />
      </div>

      <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">
        Today&apos;s Challenge
      </p>

      <h3 className="mt-2 text-2xl font-black uppercase">{title}</h3>

      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {description}
      </p>

      <p className="mt-4 text-xl font-black text-orange-500">{points}</p>
    </div>
  );
}