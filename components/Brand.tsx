import Link from "next/link";

export function LogoLockup() {
  return (
    <Link href="/" className="group inline-flex items-center gap-3">
      <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-plate bg-[length:8px_8px] shadow-glow">
        <div className="absolute inset-0 bg-acid/10" />
        <span className="relative text-xl font-black tracking-tighter text-acid">BG</span>
      </div>
      <div className="leading-none">
        <p className="text-lg font-black uppercase tracking-tight">BestGymsMalta</p>
        <p className="text-xs font-bold uppercase tracking-[.25em] text-acid">Be the Best</p>
      </div>
    </Link>
  );
}

export function Slogan() {
  return (
    <div className="space-y-1">
      <p className="text-5xl font-black uppercase leading-[.85] tracking-tighter sm:text-7xl">
        Be the Best<span className="text-acid">...</span>
      </p>
      <p className="text-5xl font-black uppercase leading-[.85] tracking-tighter text-acid sm:text-7xl">
        Beat the Rest
      </p>
    </div>
  );
}
