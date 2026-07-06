import { ReactNode } from "react";

type StatCardProps = {
  icon: ReactNode;
  value: string;
  label: string;
};

export default function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-center shadow-[0_0_25px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#fcb415]/10 text-[#fcb415]">
        {icon}
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}