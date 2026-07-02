import { Target } from "lucide-react";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";
import { todaysFocus } from "@/components/data/focus";

export default function TodaysFocus() {
  return (
    <GlassPanel className="mt-5">
      <div className="flex items-start gap-4">
        <div className="icon-token h-14 w-14 rounded-[22px]">
          <Target size={28} />
        </div>

        <div className="flex-1">
          <p className="luxury-label">Today&apos;s Focus</p>

          <h2 className="mt-2 text-3xl font-black uppercase italic leading-none">
            {todaysFocus.title}
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            {todaysFocus.description}
          </p>

          <p className="mt-3 text-xl font-black text-primary">
            {todaysFocus.reward}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Button href={todaysFocus.href} className="w-full">
          {todaysFocus.buttonText}
        </Button>
      </div>
    </GlassPanel>
  );
}