"use client";

import { useEffect, useState } from "react";
import { Activity, Medal, QrCode } from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type MemberStats = {
  totalCheckins: number;
  passportStamps: number;
  latestCheckinAt: string | null;
};

export default function MemberActivityStats() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [stats, setStats] = useState<MemberStats>({
    totalCheckins: 0,
    passportStamps: 0,
    latestCheckinAt: null,
  });

  useEffect(() => {
    async function loadStats() {
      const savedMember = getSavedMember();
      setMember(savedMember);

      if (!savedMember) {
        setStats({
          totalCheckins: 0,
          passportStamps: 0,
          latestCheckinAt: null,
        });
        return;
      }

      try {
        const response = await fetch(`/api/checkins?memberId=${savedMember.id}`, {
          cache: "no-store",
        });

        const data = await response.json();
        setStats(
          data.stats || {
            totalCheckins: 0,
            passportStamps: 0,
            latestCheckinAt: null,
          }
        );
      } catch {
        setStats({
          totalCheckins: 0,
          passportStamps: 0,
          latestCheckinAt: null,
        });
      }
    }

    loadStats();

    window.addEventListener("bgmMemberChanged", loadStats);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadStats);
    };
  }, []);

  if (!member) {
    return (
      <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
          Member Stats
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Login to see your stats
        </h2>
        <p className="mt-3 text-sm font-bold leading-6 text-white/55">
          Your check-ins, passport stamps and progress are saved to your member
          account.
        </p>
        <a
          href="/member-login"
          className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          Login / Activate
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
        Member Stats
      </p>

      <h2 className="mt-2 text-2xl font-black text-white">
        {member.fullName || member.username}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <QrCode className="text-[#fcb415]" size={22} strokeWidth={3} />
          <p className="mt-3 text-2xl font-black text-white">
            {stats.totalCheckins}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[.16em] text-white/35">
            Check-ins
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <Medal className="text-[#fcb415]" size={22} strokeWidth={3} />
          <p className="mt-3 text-2xl font-black text-white">
            {stats.passportStamps}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[.16em] text-white/35">
            Stamps
          </p>
        </div>
      </div>

      {stats.latestCheckinAt ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <Activity className="text-green-300" size={22} strokeWidth={3} />
          <p className="text-sm font-bold text-white/55">
            Last visit: {new Date(stats.latestCheckinAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </section>
  );
}
