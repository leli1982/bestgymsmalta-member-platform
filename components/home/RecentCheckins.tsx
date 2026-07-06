"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getSavedMember } from "@/lib/memberSession";

type RecentCheckin = {
  id: string;
  gymId: string;
  gymName: string;
  gymLogo?: string;
  checkinAt: string;
};

export default function RecentCheckins() {
  const [checkins, setCheckins] = useState<RecentCheckin[]>([]);

  useEffect(() => {
    async function loadCheckins() {
      const member = getSavedMember();

      if (!member) {
        setCheckins([]);
        return;
      }

      try {
        const response = await fetch(`/api/checkins?memberId=${member.id}`, {
          cache: "no-store",
        });

        const data = await response.json();
        setCheckins(data.recentCheckins || []);
      } catch {
        setCheckins([]);
      }
    }

    loadCheckins();

    window.addEventListener("bgmMemberChanged", loadCheckins);

    return () => {
      window.removeEventListener("bgmMemberChanged", loadCheckins);
    };
  }, []);

  if (checkins.length === 0) return null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-[#fcb415]" size={24} strokeWidth={3} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
            Recent Check-ins
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Latest visits
          </h2>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {checkins.map((checkin) => (
          <div
            key={checkin.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4"
          >
            <div>
              <p className="text-sm font-black text-white">
                {checkin.gymName}
              </p>
              <p className="mt-1 text-xs font-bold text-white/40">
                {new Date(checkin.checkinAt).toLocaleString()}
              </p>
            </div>

            {checkin.gymLogo ? (
              <img
                src={checkin.gymLogo}
                alt=""
                className="h-10 w-10 object-contain"
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
