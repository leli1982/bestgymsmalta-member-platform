import {
  BarChart3,
  Camera,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  MapPinned,
  Megaphone,
  Stamp,
} from "lucide-react";

const primaryTools = [
  {
    label: "AI Trainer",
    description: "Get personalised workouts & advice",
    href: "/trainer",
    icon: Dumbbell,
  },
  {
    label: "Mobility & Stretch",
    description: "Improve flexibility and recovery",
    href: "/mobility-stretch",
    icon: HeartPulse,
  },
  {
    label: "Progress",
    description: "Track your journey and see results",
    href: "/progress",
    icon: BarChart3,
  },
];

const secondaryTools = [
  { label: "Passport", description: "Access more gyms", href: "/passport", icon: Stamp },
  { label: "Story Creator", description: "Share your workout", href: "/story", icon: Camera },
  { label: "Gyms", description: "Find and explore gyms", href: "/gyms", icon: MapPinned },
  { label: "Announcements", description: "Stay updated with the latest", href: "#announcements", icon: Megaphone },
];

export default function MemberHomePrimaryTools() {
  return (
    <section aria-label="Member tools" className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        {primaryTools.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="group flex min-h-[176px] flex-col items-center rounded-[1.45rem] border border-zinc-200/80 bg-white px-2.5 py-4 text-center shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition active:scale-[0.98]"
            >
              <Icon className="text-[#ff5a0a]" size={31} strokeWidth={3} />
              <h2 className="mt-3 text-[13px] font-black leading-tight text-zinc-950 sm:text-sm">
                {item.label}
              </h2>
              <p className="mt-2 text-[10px] font-semibold leading-[1.35] text-slate-500 sm:text-[11px]">
                {item.description}
              </p>
              <span className="mt-auto flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-[#ff5a0a] transition group-hover:bg-orange-100">
                <ChevronRight size={16} strokeWidth={3} />
              </span>
            </a>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {secondaryTools.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href}
              className="group flex min-h-[142px] min-w-0 flex-col items-center rounded-[1.3rem] border border-zinc-200/80 bg-white px-1.5 py-3.5 text-center shadow-[0_5px_18px_rgba(15,23,42,0.05)] transition active:scale-[0.98]"
            >
              <Icon className="text-[#ff5a0a]" size={27} strokeWidth={3} />
              <h3 className="mt-2.5 text-[10px] font-black leading-tight text-zinc-950 sm:text-[11px]">
                {item.label}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[9px] font-semibold leading-[1.3] text-slate-500">
                {item.description}
              </p>
              <span className="mt-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-[#ff5a0a]">
                <ChevronRight size={14} strokeWidth={3} />
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
