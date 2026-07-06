import { MapPinned } from "lucide-react";

type PassportProgressPreviewProps = {
  title?: string;
  current?: number;
  target?: number;
};

export default function PassportProgressPreview({
  title = "Passport Progress",
  current = 6,
  target = 10,
}: PassportProgressPreviewProps) {
  const progress = Math.min(100, Math.round((current / target) * 100));

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#fcb415]/10 p-3 text-[#fcb415]">
          <MapPinned size={22} strokeWidth={3} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Passport
          </p>
          <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#fcb415]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-sm font-bold text-white/45">
        {current} / {target} gyms visited
      </p>
    </section>
  );
}
