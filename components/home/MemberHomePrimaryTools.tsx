import {
  Bot,
  Camera,
  ChevronRight,
  HeartPulse,
  MapPinned,
  Sparkles,
  Stamp,
  UserCircle,
  Video,
} from "lucide-react";

const secondaryTools = [
  { label: "Passport", href: "/passport", icon: Stamp },
  { label: "Story", href: "/story", icon: Video },
  { label: "Gyms", href: "/gyms", icon: MapPinned },
  { label: "Account", href: "/member-login", icon: UserCircle },
];

export default function MemberHomePrimaryTools() {
  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-600">
            AI & Progress
          </p>
          <h2 className="mt-1 text-2xl font-black text-zinc-950">Your training tools</h2>
        </div>
        <Sparkles className="text-orange-500" size={25} strokeWidth={3} />
      </div>

      <a
        href="/trainer"
        className="group mt-5 block overflow-hidden rounded-[1.6rem] bg-zinc-950 p-5 text-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white">
            <Bot size={25} strokeWidth={3} />
          </div>
          <ChevronRight className="text-white/45 transition group-hover:translate-x-1" size={20} strokeWidth={3} />
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[.22em] text-orange-400">Powered by AI</p>
        <h3 className="mt-1 text-2xl font-black">AI Trainer</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-white/60">
          Build and manage a workout plan around your goals.
        </p>
      </a>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <a
          href="/mobility-stretch"
          className="group rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 text-zinc-950 transition hover:border-orange-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <HeartPulse size={22} strokeWidth={3} />
            </div>
            <ChevronRight className="text-zinc-300 transition group-hover:translate-x-1" size={18} strokeWidth={3} />
          </div>
          <h3 className="mt-4 text-base font-black leading-tight">Mobility & Stretch</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">Guided mobility and stretching.</p>
        </a>

        <a
          href="/progress"
          className="group rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4 text-zinc-950 transition hover:border-orange-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Camera size={22} strokeWidth={3} />
            </div>
            <ChevronRight className="text-zinc-300 transition group-hover:translate-x-1" size={18} strokeWidth={3} />
          </div>
          <h3 className="mt-4 text-base font-black leading-tight">Progress</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">Track photos, strength and your journey.</p>
        </a>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 border-t border-zinc-100 pt-4">
        {secondaryTools.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
            >
              <Icon size={20} strokeWidth={2.7} className="text-orange-500" />
              <span className="w-full truncate text-[10px] font-black">{item.label}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
