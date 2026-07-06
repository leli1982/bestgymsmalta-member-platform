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
          <span className="font-black text-[#fcb415]">{value}%</span>
        </div>
      )}

      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#fcb415] shadow-[0_0_18px_rgba(252,180,21,0.6)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}