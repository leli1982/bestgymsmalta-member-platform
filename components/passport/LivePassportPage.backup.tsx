"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, RefreshCw, Stamp } from "lucide-react";
import type { Gym } from "@/components/data/gyms";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

export default function LivePassportPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [visitedGymIds, setVisitedGymIds] = useState<string[]>([]);
  const [member, setMember] = useState<AppMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPassport() {
      const savedMember = getSavedMember();
      setMember(savedMember);

      try {
        const gymsResponse = await fetch("/api/gyms", { cache: "no-store" });
        const gymsData = await gymsResponse.json();
        setGyms(gymsData.gyms || []);

        if (savedMember) {
          const checkinsResponse = await fetch(
            `/api/checkins?memberId=${savedMember.id}`,
            { cache: "no-store" }
          );
          const checkinsData = await checkinsResponse.json();
          setVisitedGymIds(checkinsData.visitedGymIds || []);
        } else {
          setVisitedGymIds([]);
        }
      } catch {
        setGyms([]);
        setVisitedGymIds([]);
      } finally {
        setLoading(false);
      }
    }

    loadPassport();
  }, []);

  const activeGyms = gyms.filter((gym) => gym.status === "active");
  const comingSoonGyms = gyms.filter((gym) => gym.status === "coming_soon");

  const completion = useMemo(() => {
    if (activeGyms.length === 0) return 0;

    return Math.round((visitedGymIds.length / activeGyms.length) * 100);
  }, [activeGyms.length, visitedGymIds.length]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#fcb415]/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fcb415]/20 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
            BGM Passport
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white">
            Collect your gym stamps
          </h1>

          <p className="mt-4 text-sm font-bold leading-6 text-white/55">
            Scan the gym QR code when you visit. Your passport updates
            automatically.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white">
                {member
                  ? `${member.fullName || member.username}'s progress`
                  : "Passport progress"}
              </p>
              <p className="text-sm font-black text-[#fcb415]">
                {visitedGymIds.length}/{activeGyms.length}
              </p>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#fcb415]"
                style={{ width: `${completion}%` }}
              />
            </div>

            <p className="mt-2 text-xs font-bold text-white/45">
              {completion}% completed
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3 text-white/45">
            <RefreshCw size={18} className="animate-spin" />
            <p className="text-sm font-bold">Loading passport…</p>
          </div>
        </section>
      ) : null}

      {!loading && !member ? (
        <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5 text-center">
          <h2 className="text-2xl font-black text-white">
            Login to use your passport
          </h2>
          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Your stamps are saved to your member account. Log in or activate
            your app account before scanning gym QR codes.
          </p>
          <a
            href="/member-login"
            className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Login / Activate
          </a>
        </section>
      ) : null}

      {!loading && member ? (
        <section className="grid gap-4">
          {activeGyms.map((gym) => {
            const visited = visitedGymIds.includes(gym.id);

            return (
              <div
                key={gym.id}
                className={`rounded-[2rem] border p-5 ${
                  visited
                    ? "border-[#fcb415]/40 bg-[#fcb415]/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                        visited
                          ? "bg-[#fcb415] text-black"
                          : "bg-black/30 text-white/35"
                      }`}
                    >
                      {visited ? (
                        <CheckCircle2 size={28} strokeWidth={3} />
                      ) : (
                        <Stamp size={28} strokeWidth={3} />
                      )}
                    </div>

                    <div>
                      <h2 className="text-lg font-black text-white">
                        {gym.name}
                      </h2>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[.16em] text-white/35">
                        {visited ? "Stamped" : "Not visited yet"}
                      </p>
                    </div>
                  </div>

                  {gym.logo ? (
                    <img
                      src={gym.logo}
                      alt=""
                      className="h-12 w-12 object-contain"
                    />
                  ) : null}
                </div>

                {!visited ? (
                  <a
                    href={`/scan-gym-qr?gymId=${gym.id}`}
                    className="mt-4 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-3 text-sm font-black text-black"
                  >
                    Scan Gym QR
                  </a>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {!loading && comingSoonGyms.length > 0 ? (
        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
            Future Stamps
          </p>

          {comingSoonGyms.map((gym) => (
            <div
              key={gym.id}
              className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 opacity-70"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/30 text-white/30">
                  <Lock size={26} strokeWidth={3} />
                </div>

                <div>
                  <h2 className="text-lg font-black text-white">{gym.name}</h2>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[.16em] text-white/35">
                    Coming soon
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
