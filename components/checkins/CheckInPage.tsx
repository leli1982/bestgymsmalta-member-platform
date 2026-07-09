"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Dumbbell,
  MapPinned,
  RefreshCw,
  Share2,
  Stamp,
  Trophy,
} from "lucide-react";
import type { Gym } from "@/components/data/gyms";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type CheckinLike = {
  gymId?: string;
  gym_id?: string;
  checkinAt?: string;
  checkin_at?: string;
  createdAt?: string;
  created_at?: string;
};

function getGymLogo(gym: Gym | null) {
  if (!gym) return "";
  return gym.logo || `/gym-logos/${gym.id}.png`;
}

function formatDateTime(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CheckInPage({ gymId }: { gymId: string }) {
  const [gym, setGym] = useState<Gym | null>(null);
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [member, setMember] = useState<AppMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [visitedCount, setVisitedCount] = useState(0);
  const [latestCheckinAt, setLatestCheckinAt] = useState("");

  const activeGyms = allGyms.filter((item) => (item.status || "active") === "active");
  const totalActiveGyms = activeGyms.length || 10;
  const progressPercent = Math.min(
    100,
    Math.round((visitedCount / totalActiveGyms) * 100)
  );

  useEffect(() => {
    const savedMember = getSavedMember();
    setMember(savedMember);

    async function loadGym() {
      try {
        const response = await fetch("/api/gyms", {
          cache: "no-store",
        });

        const data = await response.json();
        const loadedGyms = data.gyms || [];
        const foundGym = loadedGyms.find((item: Gym) => item.id === gymId);

        setAllGyms(loadedGyms);
        setGym(foundGym || null);

        if (savedMember?.id) {
          await loadPassportProgress(savedMember.id, loadedGyms);
        }
      } catch {
        setGym(null);
      } finally {
        setLoading(false);
      }
    }

    loadGym();
  }, [gymId]);

  async function loadPassportProgress(memberId: string, loadedGyms = allGyms) {
    try {
      const response = await fetch(
        `/api/checkins?memberId=${encodeURIComponent(memberId)}&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();
      const checkins: CheckinLike[] = data.checkins || [];

      const activeGymIds = new Set(
        loadedGyms
          .filter((item) => (item.status || "active") === "active")
          .map((item) => item.id)
      );

      const visitedGymIds = new Set(
        checkins
          .map((item) => item.gymId || item.gym_id)
          .filter((id): id is string => Boolean(id))
          .filter((id) => !activeGymIds.size || activeGymIds.has(id))
      );

      setVisitedCount(visitedGymIds.size);

      const latest = checkins[0];

      if (latest) {
        setLatestCheckinAt(
          latest.checkinAt ||
            latest.checkin_at ||
            latest.createdAt ||
            latest.created_at ||
            ""
        );
      }
    } catch {
      // Passport progress is a bonus. Do not block check-in if this fails.
    }
  }

  async function confirmCheckIn() {
    if (!member) {
      setMessage("Please log in before checking in.");
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetch("/api/checkins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        memberId: member.id,
        gymId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Could not check in.");
      setSaving(false);
      return;
    }

    setCheckedIn(true);
    setMessage(data.message || "Check-in saved.");
    await loadPassportProgress(member.id);
    setSaving(false);
  }

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3 text-white/45">
          <RefreshCw size={18} className="animate-spin" />
          <p className="text-sm font-bold">Loading check-in…</p>
        </div>
      </section>
    );
  }

  if (!gym) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h1 className="text-3xl font-black text-white">Gym not found</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-white/50">
          This QR code does not match a BGM gym.
        </p>
        <a
          href="/gyms"
          className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          View Gyms
        </a>
      </section>
    );
  }

  const logo = getGymLogo(gym);

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.20), rgba(0,0,0,.88)), linear-gradient(135deg, rgba(252,180,21,.25), rgba(0,0,0,.85))",
        }}
      >
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fcb415]/25 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#fcb415]/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
                BGM Check-in
              </p>

              <h1 className="mt-4 text-4xl font-black leading-tight text-white">
                {gym.name}
              </h1>
            </div>

            {logo ? (
              <img
                src={logo}
                alt=""
                className="h-24 w-24 shrink-0 object-contain drop-shadow-2xl"
              />
            ) : null}
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-6 text-white/55">
            <MapPinned className="mt-0.5 text-[#fcb415]" size={17} />
            {gym.address}
          </p>
        </div>
      </section>

      {!member ? (
        <section className="rounded-[2rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5 text-center">
          <h2 className="text-2xl font-black text-white">Login required</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Please log in or activate your account before checking in. This
            connects the stamp to your own member passport.
          </p>

          <a
            href="/member-login"
            className="mt-5 flex items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
          >
            Login / Activate
          </a>
        </section>
      ) : checkedIn ? (
        <section className="relative overflow-hidden rounded-[2.3rem] border border-[#fcb415]/30 bg-[#fcb415]/10 p-5 text-center shadow-2xl">
          <div className="absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-full bg-[#fcb415]/20 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-400/10 text-green-300">
              <CheckCircle2 size={52} strokeWidth={3} />
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[.25em] text-[#fcb415]">
              Stamp collected
            </p>

            <h2 className="mt-2 text-4xl font-black leading-tight text-white">
              Passport stamped
            </h2>

            <p className="mt-3 text-sm font-bold leading-6 text-white/60">
              {message || "Your visit has been added to your BGM passport."}
            </p>

            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-black/25 p-4 text-left">
              <div className="flex items-center gap-4">
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="h-20 w-20 shrink-0 object-contain drop-shadow-2xl"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
                    <Stamp size={30} strokeWidth={3} />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-xl font-black text-white">
                    {gym.name}
                  </p>

                  <p className="mt-1 text-xs font-black uppercase tracking-[.16em] text-[#fcb415]">
                    {member.fullName || member.username} · {member.memberNumber}
                  </p>

                  {latestCheckinAt ? (
                    <p className="mt-2 text-xs font-bold text-white/40">
                      {formatDateTime(latestCheckinAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-white/35">
                    Passport progress
                  </p>

                  <p className="mt-1 text-2xl font-black text-white">
                    {visitedCount} / {totalActiveGyms} gyms
                  </p>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fcb415] text-black">
                  <Trophy size={28} strokeWidth={3} />
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#fcb415]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <a
                href="/passport"
                className="rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
              >
                View Passport
              </a>

              <a
                href="/story"
                className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
              >
                <Share2 size={16} strokeWidth={3} />
                Share
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#fcb415]/10 text-[#fcb415]">
            <Dumbbell size={38} strokeWidth={3} />
          </div>

          <h2 className="mt-5 text-2xl font-black text-white">
            Confirm your visit
          </h2>

          <p className="mt-2 text-xs font-black uppercase tracking-[.18em] text-[#fcb415]">
            {member.fullName || member.username} · {member.memberNumber}
          </p>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            {message ||
              "Tap below to confirm your check-in and add this gym to your passport."}
          </p>

          <button
            type="button"
            onClick={confirmCheckIn}
            disabled={saving || gym.status !== "active"}
            className="mt-5 w-full rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black disabled:opacity-40"
          >
            {saving ? "Checking in…" : "Confirm Check-in"}
          </button>

          {gym.status !== "active" ? (
            <p className="mt-3 text-xs font-bold text-red-300">
              This gym is not active for check-ins yet.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
