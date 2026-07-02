import { CalendarDays, Flame } from "lucide-react";

type TopBarProps = {
  name?: string;
  greeting?: string;
  date?: string;
  streak?: number;
};

export default function TopBar({
  name = "Leli",
  greeting = "Good Evening,",
  date = "Tuesday • 30 June",
  streak = 12,
}: TopBarProps) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.45em] text-primary">
            {greeting}
          </p>

          <h1 className="mt-2 text-6xl font-black uppercase italic leading-none tracking-tight">
            {name}
          </h1>

          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={16} className="text-primary" />
            <span>{date}</span>
          </div>
        </div>

        <img
          src="/logos/bgm-main.png"
          alt="BestGymsMalta"
          className="w-24 object-contain drop-shadow-[0_0_20px_rgba(249,115,22,0.35)]"
        />
      </div>

      <div className="mt-7 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary shadow-glow">
          <Flame size={32} fill="currentColor" />
        </div>

        <div>
          <p className="text-4xl font-black uppercase italic leading-none">
            {streak}
            <span className="ml-2 text-base font-black tracking-[0.35em] text-primary">
              DAY STREAK
            </span>
          </p>
          <p className="mt-1 text-sm italic text-muted">
            Keep it alive today.
          </p>
        </div>
      </div>
    </header>
  );
}