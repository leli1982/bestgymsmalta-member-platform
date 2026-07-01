import ProgressBar from "@/components/ui/ProgressBar";

type RewardPreviewProps = {
  title: string;
  current: number;
  target: number;
};

export default function RewardPreview({
  title,
  current,
  target,
}: RewardPreviewProps) {
  const percent = Math.min(Math.round((current / target) * 100), 100);

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950 p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">
        Next Reward
      </p>

      <h3 className="mt-2 text-2xl font-black uppercase">{title}</h3>

      <p className="mt-2 text-sm text-zinc-400">
        {current} / {target} points
      </p>

      <div className="mt-4">
        <ProgressBar value={percent} />
      </div>
    </div>
  );
}