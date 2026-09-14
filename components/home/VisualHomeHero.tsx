"use client";

import { useEffect, useState } from "react";
import { Bell, CreditCard, MapPin } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

export default function VisualHomeHero() {
  const [member, setMember] = useState<AppMember | null>(null);

  useEffect(() => {
    function loadMember() {
      setMember(getSavedMember());
    }

    loadMember();
    window.addEventListener("bgmMemberChanged", loadMember);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadMember);
    };
  }, []);

  const welcomeName = member?.fullName?.split(" ")[0] || member?.username || "Member";

  return (
    <section
      className="relative min-h-[414px] overflow-hidden bg-black bg-cover bg-[38%_center] text-white sm:min-h-[430px] sm:bg-[40%_center]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(0,0,0,.82) 0%, rgba(0,0,0,.58) 34%, rgba(0,0,0,.08) 72%, rgba(0,0,0,.04) 100%), linear-gradient(180deg, rgba(0,0,0,.04) 0%, rgba(0,0,0,.02) 58%, rgba(0,0,0,.48) 100%), url('/visuals/home-hero-duo.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(255,90,10,.15),transparent_35%)]" />

      <div className="relative flex min-h-[414px] flex-col px-5 pb-5 pt-6 sm:min-h-[430px] sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 drop-shadow-lg">
            <img
              src="/bgm-logo.png"
              alt="BestGymsMalta"
              className="h-11 w-11 shrink-0 object-contain"
            />
            <span className="truncate text-[11px] font-black tracking-[-0.02em] text-white sm:text-xs">
              WWW.BESTGYMSMALTA.COM
            </span>
          </div>
          <span className="relative mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm">
            <Bell size={22} strokeWidth={2.3} />
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff5a0a]" />
          </span>
        </div>

        <div
          className="absolute left-5 top-[84px] -rotate-6 text-[25px] font-bold leading-[0.9] text-[#ff5a0a] drop-shadow-lg sm:left-6 sm:text-[28px]"
          style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
        >
          More<br />Than Gyms
          <span className="mt-1 block h-[3px] w-24 -rotate-3 rounded-full bg-[#ff5a0a]" />
        </div>

        <div className="mt-auto max-w-[62%] pb-[76px]">
          <h1 className="text-[31px] font-black leading-[0.98] tracking-[-0.035em] drop-shadow-xl sm:text-[34px]">
            Welcome back,
            <span className="mt-1 block text-[42px] text-[#ff5a0a] sm:text-[46px]">{welcomeName}</span>
          </h1>
          <p className="mt-3 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em] text-white/88 sm:text-[17px]">
            be the best...beat the rest
          </p>
        </div>

        <div className="absolute bottom-5 left-5 right-5 grid grid-cols-2 gap-3 sm:left-6 sm:right-6">
          <a
            href="/card"
            className="flex min-h-[58px] items-center justify-center gap-2.5 rounded-[1.25rem] bg-[#ff5a0a] px-3 text-[15px] font-black text-white shadow-[0_10px_28px_rgba(255,90,10,.25)] transition active:scale-[0.98]"
          >
            <CreditCard size={20} strokeWidth={2.8} />
            Show Card
          </a>
          <a
            href="/gyms"
            className="flex min-h-[58px] items-center justify-center gap-2.5 rounded-[1.25rem] border-2 border-[#ff5a0a] bg-black/60 px-3 text-[15px] font-black text-white backdrop-blur-sm transition active:scale-[0.98]"
          >
            <MapPin className="text-[#ff5a0a]" size={21} strokeWidth={3} />
            Find Gyms
          </a>
        </div>
      </div>
    </section>
  );
}
