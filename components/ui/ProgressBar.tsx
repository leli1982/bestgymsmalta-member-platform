type ProgressBarProps = {
  value: number;
  label?: string;
};

export default function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div>
      {label && (
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-zinc-400">{label}</span>
          <span className="font-black text-orange-500">{value}%</span>
        </div>
      )}

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.6)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}