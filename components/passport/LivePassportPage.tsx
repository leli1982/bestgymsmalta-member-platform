"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Lock,
  MapPin,
  QrCode,
  RefreshCw,
  Sparkles,
  Stamp,
  Target,
  Trophy,
} from "lucide-react";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

type Gym = {
  id: string;
  name: string;
  shortName?: string;
  short_name?: string;
  city?: string;
  status?: string;
  address?: string;
  logo?: string;
  coverImage?: string;
  cover_image?: string;
};

type CheckIn = {
  id: string;
  gymId?: string;
  gym_id?: string;
  gymName?: string;
  gym_name?: string;
  checkinAt?: string;
  checkin_at?: string;
  createdAt?: string;
  created_at?: string;
};

const gymCoverImages: Record<string, string> = {
  "bgm-birkirkara": "/visuals/gyms/birkirkara.jpg",
  "bgm-birzebbuga": "/visuals/gyms/birzebbuga.jpg",
  "bgm-build": "/visuals/gyms/build.jpg",
  "bgm-kirkop": "/visuals/gyms/kirkop.jpg",
  "bgm-marsa": "/visuals/gyms/marsa.jpg",
  "bgm-marsascala": "/visuals/gyms/marsascala.jpg",
  "bgm-neptunes": "/visuals/gyms/neptunes.jpg",
  "bgm-pembroke": "/visuals/gyms/pembroke.jpg",
  "bgm-sliema": "/visuals/gyms/sliema.jpg",
  "bgm-talqroqq": "/visuals/gyms/talqroqq.jpg",
  "bgm-birgu": "/visuals/gyms/birgu.jpg",
};

function getGymName(gym: Gym) {
  return gym.shortName || gym.short_name || gym.name;
}

function getGymCover(gym: Gym) {
  return gym.coverImage || gym.cover_image || gymCoverImages[gym.id] || "/visuals/gyms.jpg";
}

function getGymLogo(gym: Gym) {
  return gym.logo || `/gym-logos/${gym.id}.png`;
}

function getCheckInGymId(checkIn: CheckIn) {
  return checkIn.gymId || checkIn.gym_id || "";
}

function getCheckInDate(checkIn: CheckIn) {
  return checkIn.checkinAt || checkIn.checkin_at || checkIn.createdAt || checkIn.created_at || "";
}

function formatDate(value: string) {
  if (!value) return "No date";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatTime(value: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function uniqueGymIds(checkIns: CheckIn[]) {
  return Array.from(new Set(checkIns.map(getCheckInGymId).filter(Boolean)));
}

export default function LivePassportPage() {
  const [member, setMember] = useState<AppMember | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMember(getSavedMember());
  }, []);

  useEffect(() => {
    loadPassport();
  }, [member?.id]);

  async function loadPassport() {
    try {
      setLoading(true);

      const gymsResponse = await fetch("/api/gyms", {
        cache: "no-store",
      });

      const gymsData = await gymsResponse.json().catch(() => ({}));
      const loadedGyms = Array.isArray(gymsData)
        ? gymsData
        : gymsData.gyms || gymsData.data || [];

      setGyms(loadedGyms);

      if (!member?.id) {
        setCheckIns([]);
        return;
      }

      const checkInsResponse = await fetch(
        `/api/checkins?memberId=${encodeURIComponent(member.id)}`,
        {
          cache: "no-store",
        }
      );

      const checkInsData = await checkInsResponse.json().catch(() => ({}));
      const loadedCheckIns = Array.isArray(checkInsData)
        ? checkInsData
        : checkInsData.checkins || checkInsData.checkIns || checkInsData.data || [];

      setCheckIns(loadedCheckIns);
    } catch {
      setGyms([]);
      setCheckIns([]);
    } finally {
      setLoading(false);
    }
  }

  const activeGyms = useMemo(() => {
    return gyms.filter((gym) => (gym.status || "active") === "active");
  }, [gyms]);

  const sortedCheckIns = useMemo(() => {
    return [...checkIns].sort((a, b) => {
      const dateA = new Date(getCheckInDate(a)).getTime();
      const dateB = new Date(getCheckInDate(b)).getTime();
      return dateB - dateA;
    });
  }, [checkIns]);

  const visitedGymIds = useMemo(() => uniqueGymIds(checkIns), [checkIns]);
  const visitedSet = useMemo(() => new Set(visitedGymIds), [visitedGymIds]);

  const stampedGyms = useMemo(() => {
    return activeGyms.filter((gym) => visitedSet.has(gym.id));
  }, [activeGyms, visitedSet]);

  const unvisitedGyms = useMemo(() => {
    return activeGyms.filter((gym) => !visitedSet.has(gym.id));
  }, [activeGyms, visitedSet]);

  const nextGym = unvisitedGyms[0] || activeGyms[0];

  const completion =
    activeGyms.length > 0
      ? Math.round((stampedGyms.length / activeGyms.length) * 100)
      : 0;

  if (!member) {
    return (
      <div className="space-y-6">
        <section
          className="relative min-h-[390px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.82)), linear-gradient(135deg, rgba(252,180,21,.22), rgba(0,0,0,.82)), url('/visuals/passport.jpg')",
          }}
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

          <div className="relative flex min-h-[340px] flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                  BGM Passport
                </p>
              </div>

              <img
                src="/bgm-logo.png"
                alt="BestGymsMalta"
                className="h-16 w-16 object-contain drop-shadow-2xl"
              />
            </div>

            <div>
              <Lock className="text-[#fcb415]" size={34} strokeWidth={3} />

              <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
                Your gym passport
              </h1>

              <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
                Log in to collect stamps as you train across the BestGymsMalta
                network.
              </p>

              <a
                href="/member-login"
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
              >
                Login / Activate
                <ChevronRight size={17} strokeWidth={3} />
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="relative min-h-[430px] overflow-hidden rounded-[2.2rem] border border-white/10 bg-cover bg-center p-6 shadow-2xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.85)), linear-gradient(135deg, rgba(252,180,21,.20), rgba(0,0,0,.82)), url('/visuals/passport.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/25 to-black/90" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#fcb415]/25 blur-3xl" />

        <div className="relative flex min-h-[380px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                BGM Passport
              </p>
            </div>

            <img
              src="/bgm-logo.png"
              alt="BestGymsMalta"
              className="h-16 w-16 object-contain drop-shadow-2xl"
            />
          </div>

          <div>
            <p className="text-sm font-black uppercase tracking-[.24em] text-[#fcb415]">
              Train across Malta
            </p>

            <h1 className="mt-4 text-5xl font-black leading-[0.95] text-white drop-shadow-2xl">
              Your BGM Gym Passport
            </h1>

            <p className="mt-5 max-w-xs text-sm font-bold leading-6 text-white/70">
              Visit every gym in the BestGymsMalta network. Each check-in adds a
              stamp to your personal passport.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/40 p-4 backdrop-blur-md">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black text-white">{completion}%</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/40">
                    Network complete
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-black text-[#fcb415]">
                    {stampedGyms.length}/{activeGyms.length}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/40">
                    Gyms stamped
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#fcb415]"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <Stamp className="text-[#fcb415]" size={22} strokeWidth={3} />
          <p className="mt-3 text-3xl font-black text-white">
            {stampedGyms.length}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            Visited
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <Dumbbell className="text-[#fcb415]" size={22} strokeWidth={3} />
          <p className="mt-3 text-3xl font-black text-white">
            {checkIns.length}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            Check-ins
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <Target className="text-[#fcb415]" size={22} strokeWidth={3} />
          <p className="mt-3 text-3xl font-black text-white">
            {unvisitedGyms.length}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
            To visit
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-5">
        <div className="flex items-start gap-3">
          <QrCode className="mt-0.5 shrink-0 text-[#fcb415]" size={28} strokeWidth={3} />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Check In
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Scan at reception
            </h2>

            <p className="mt-3 text-sm font-bold leading-6 text-white/60">
              Scan the gym QR code when you visit. Your passport stamp will be
              saved against your member account.
            </p>

            <a
              href="/scan-gym-qr"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
            >
              Scan Gym QR
              <QrCode size={17} strokeWidth={3} />
            </a>
          </div>
        </div>
      </section>

      {nextGym ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
          <div
            className="min-h-[230px] bg-cover bg-center p-5"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.80)), url('${getGymCover(nextGym)}')`,
            }}
          >
            <div className="flex min-h-[190px] flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="rounded-full bg-[#fcb415] px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-black">
                  Next Gym To Visit
                </div>

                <img
                  src={getGymLogo(nextGym)}
                  alt=""
                  className="h-14 w-14 object-contain drop-shadow-2xl"
                />
              </div>

              <div>
                <h2 className="text-4xl font-black leading-none text-white">
                  {getGymName(nextGym)}
                </h2>

                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-white/65">
                  <MapPin size={16} strokeWidth={3} />
                  {nextGym.city || nextGym.address || "BestGymsMalta"}
                </p>

                <a
                  href={`/gyms/${nextGym.id}`}
                  className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-sm font-black text-black"
                >
                  View Gym
                  <ChevronRight size={17} strokeWidth={3} />
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {stampedGyms.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Stamped Gyms
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Places you trained
              </h2>
            </div>

            <Trophy className="text-[#fcb415]" size={26} strokeWidth={3} />
          </div>

          <div className="mt-5 grid gap-3">
            {stampedGyms.map((gym) => {
              const gymCheckIns = sortedCheckIns.filter(
                (checkIn) => getCheckInGymId(checkIn) === gym.id
              );
              const latest = gymCheckIns[0];

              return (
                <a
                  key={gym.id}
                  href={`/gyms/${gym.id}`}
                  className="flex items-center gap-4 rounded-[1.5rem] border border-[#fcb415]/20 bg-black/25 p-4"
                >
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415]/10 p-2">
                    <img
                      src={getGymLogo(gym)}
                      alt=""
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#fcb415] text-black">
                      <BadgeCheck size={17} strokeWidth={3} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-black text-white">
                      {getGymName(gym)}
                    </h3>

                    <p className="mt-1 text-xs font-bold text-white/45">
                      {gymCheckIns.length} check-in{gymCheckIns.length === 1 ? "" : "s"}
                      {latest ? ` • Last ${formatDate(getCheckInDate(latest))}` : ""}
                    </p>
                  </div>

                  <ChevronRight className="text-white/30" size={20} strokeWidth={3} />
                </a>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
          <Sparkles className="mx-auto text-[#fcb415]" size={42} strokeWidth={3} />

          <h2 className="mt-4 text-3xl font-black text-white">
            Start your passport
          </h2>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            Your first QR check-in will stamp your first BGM gym.
          </p>
        </section>
      )}

      {unvisitedGyms.length > 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
                Still To Visit
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Complete the network
              </h2>
            </div>

            <MapPin className="text-[#fcb415]" size={25} strokeWidth={3} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {unvisitedGyms.map((gym) => (
              <a
                key={gym.id}
                href={`/gyms/${gym.id}`}
                className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25"
              >
                <div
                  className="min-h-[115px] bg-cover bg-center p-3"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.72)), url('${getGymCover(gym)}')`,
                  }}
                >
                  <img
                    src={getGymLogo(gym)}
                    alt=""
                    className="h-12 w-12 object-contain drop-shadow-xl"
                  />
                </div>

                <div className="p-3">
                  <h3 className="truncate text-sm font-black text-white">
                    {getGymName(gym)}
                  </h3>

                  <p className="mt-1 truncate text-xs font-bold text-white/40">
                    Not stamped yet
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : activeGyms.length > 0 ? (
        <section className="rounded-[2rem] border border-[#fcb415]/25 bg-[#fcb415]/10 p-6 text-center">
          <Trophy className="mx-auto text-[#fcb415]" size={46} strokeWidth={3} />

          <h2 className="mt-4 text-3xl font-black text-white">
            Passport complete
          </h2>

          <p className="mt-3 text-sm font-bold leading-6 text-white/60">
            You have stamped every active BestGymsMalta gym in the network.
          </p>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#fcb415]">
              Recent Check-ins
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              Your latest visits
            </h2>
          </div>

          {loading ? (
            <RefreshCw className="animate-spin text-[#fcb415]" size={24} strokeWidth={3} />
          ) : (
            <CalendarDays className="text-[#fcb415]" size={24} strokeWidth={3} />
          )}
        </div>

        <div className="mt-5 space-y-3">
          {sortedCheckIns.slice(0, 8).map((checkIn) => {
            const gymId = getCheckInGymId(checkIn);
            const gym = activeGyms.find((item) => item.id === gymId);
            const date = getCheckInDate(checkIn);

            return (
              <article
                key={checkIn.id}
                className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-black/25 p-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fcb415] text-black">
                  <Stamp size={23} strokeWidth={3} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-black text-white">
                    {gym ? getGymName(gym) : checkIn.gymName || checkIn.gym_name || "BGM Gym"}
                  </h3>

                  <p className="mt-1 text-xs font-bold text-white/45">
                    {formatDate(date)}
                    {formatTime(date) ? ` • ${formatTime(date)}` : ""}
                  </p>
                </div>
              </article>
            );
          })}

          {!loading && sortedCheckIns.length === 0 ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5 text-center">
              <QrCode className="mx-auto text-[#fcb415]" size={34} strokeWidth={3} />
              <p className="mt-3 text-sm font-bold text-white/45">
                No check-ins yet. Scan your first gym QR to start collecting stamps.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
