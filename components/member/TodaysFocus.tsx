import { ArrowRight, Camera, Dumbbell } from "lucide-react";
import { todaysFocus } from "@/components/data/focus";

export default function TodaysFocus() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#fcb415]/10 p-3 text-[#fcb415]">
          <Dumbbell size={24} strokeWidth={3} />
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Today&apos;s Focus
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {todaysFocus.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            {todaysFocus.description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href="/goals"
          className="flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-3 text-sm font-black text-black"
        >
          {todaysFocus.actionLabel}
          <ArrowRight size={17} strokeWidth={3} />
        </a>

        <a
          href="/story"
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
        >
          <Camera size={17} strokeWidth={3} />
          {todaysFocus.secondaryLabel}
        </a>
      </div>
    </section>
  );
}
