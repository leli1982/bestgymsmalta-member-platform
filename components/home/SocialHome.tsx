"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { currentMember } from "@/components/data/member";
import LiveUpdates from "@/components/home/LiveUpdates";
import RecentCheckins from "@/components/home/RecentCheckins";
import { activeGyms } from "@/components/data/gyms";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Camera,
  ChevronRight,
  Dumbbell,
  Flame,
  MapPinned,
  MessageCircle,
  Navigation,
  ShieldCheck,
  Sparkles,
  Stamp,
} from "lucide-react";

type SavedWorkoutPlan = {
  goal: string;
  level: string;
  daysPerWeek: number;
  minutes: number;
  style: string;
  savedAt: string;
};

const STORAGE_KEY = "bgmSavedWorkoutPlan";

const member = currentMember as any;

function goalLabel(goal?: string) {
  if (goal === "fat_loss") return "Fat Loss";
  if (goal === "muscle") return "Build Muscle";
  if (goal === "strength") return "Strength";
  return "General Fitness";
}

function levelLabel(level?: string) {
  if (level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  if (level === "advanced") return "Advanced";
  return "Member";
}

function getMapsUrl(latitude?: number, longitude?: number, fallback?: string) {
  const query =
    typeof latitude === "number" && typeof longitude === "number"
      ? `${latitude},${longitude}`
      : fallback || "BestGymsMalta";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

const feedItems = [
  {
    icon: Flame,
    label: "Story Challenge",
    title: "Post your workout story today",
    text: "Add your gym logo, BGM watermark, emoji or caption and share it on Instagram, Facebook or TikTok.",
    href: "/story",
  },
  {
    icon: Bot,
    label: "AI Trainer",
    title: "Need a plan for today?",
    text: "Generate a workout based on your goal, level, time and training style.",
    href: "/trainer",
  },
];

const quickActions = [
  {
    title: "Card",
    text: "Open your digital membership",
    href: "/card",
    icon: ShieldCheck,
  },
  {
    title: "Trainer",
    text: "Build your workout",
    href: "/trainer",
    icon: Bot,
    trainer: true,
  },
  {
    title: "Story",
    text: "Create and share",
    href: "/story",
    icon: Camera,
  },
  {
    title: "Gyms",
    text: "Locations and maps",
    href: "/gyms",
    icon: MapPinned,
  },
];

export default function SocialHome() {
  const [savedPlan, setSavedPlan] = useState<SavedWorkoutPlan | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SavedWorkoutPlan;
      setSavedPlan(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const visitedGymIds = useMemo(() => {
    return Array.isArray(member.passport?.visitedGymIds)
      ? member.passport.visitedGymIds
      : [];
  }, []);

  const visitedCount = activeGyms.filter((gym) =>
    visitedGymIds.includes(gym.id)
  ).length;

  const passportProgress =
    activeGyms.length > 0
      ? Math.round((visitedCount / activeGyms.length) * 100)
      : 0;

  const nextGym =
    activeGyms.find((gym) => !visitedGymIds.includes(gym.id)) || activeGyms[0];

  const nextGymMapsUrl = nextGym
    ? getMapsUrl(nextGym.latitude, nextGym.longitude, nextGym.address)
    : "#";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-6 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
                BestGymsMalta
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white">
                Welcome back, {member.firstName || member.fullName || "Member"}
              </h1>
              <p className="mt-4 text-sm font-bold leading-6 text-white/55">
                Your membership, training, passport and stories in one place.
              </p>
            </div>

            <div className="relative h-20 w-24 shrink-0">
              <Image
                src="/bgm-logo.png"
                alt="BestGymsMalta"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center">
              <p className="text-2xl font-black text-white">
                {visitedCount}/{activeGyms.length}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
                Gyms
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center">
              <p className="text-2xl font-black text-white">
                {member.fitness?.streak || 0}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
                Streak
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-center">
              <p className="text-2xl font-black text-white">
                {member.social?.storiesShared || 0}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.18em] text-white/35">
                Stories
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <a
          href="/card"
          className="group overflow-hidden rounded-[2rem] border border-orange-500/25 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 p-5 shadow-2xl transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-green-300">
                  {member.status || "Active"}
                </p>
              </div>

              <h2 className="mt-4 text-2xl font-black text-white">
                Digital Membership Card
              </h2>

              <p className="mt-2 text-sm font-bold leading-6 text-white/50">
                Tap to open your premium flip card and membership details.
              </p>
            </div>

            <div className="rounded-2xl bg-orange-500 p-3 text-black">
              <BadgeCheck size={26} strokeWidth={3} />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                Member No.
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {member.membershipNumber || "BGM-0001"}
              </p>
            </div>

            <ChevronRight
              className="text-orange-500 transition group-hover:translate-x-1"
              size={24}
              strokeWidth={3}
            />
          </div>
        </a>

        <a
          href="/trainer"
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition active:scale-[0.99]"
        >
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border border-orange-500/50 bg-black">
              <Image
                src="/bgm-trainer-icon.png"
                alt="BGM AI Trainer"
                fill
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Virtual Trainer
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                {savedPlan ? "Continue your saved plan" : "Build today’s plan"}
              </h2>

              <p className="mt-2 text-sm font-bold leading-6 text-white/50">
                {savedPlan
                  ? `${goalLabel(savedPlan.goal)} · ${levelLabel(
                      savedPlan.level
                    )} · ${savedPlan.daysPerWeek} days · ${
                      savedPlan.minutes
                    } minutes`
                  : "Generate a workout plan and chat with your BGM trainer."}
              </p>
            </div>

            <ArrowRight className="mt-2 shrink-0 text-orange-500" size={22} />
          </div>
        </a>

        <a
          href="/story"
          className="relative overflow-hidden rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5 transition active:scale-[0.99]"
        >
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-orange-500/20 blur-2xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Social Story
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Create your BGM story
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-white/50">
                Add gym logos, BGM, TSM, emojis and captions to your photo.
              </p>
            </div>

            <div className="rounded-2xl bg-orange-500 p-3 text-black">
              <Camera size={26} strokeWidth={3} />
            </div>
          </div>
        </a>
      </section>

      <LiveUpdates />

      <RecentCheckins />

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
              Passport
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {passportProgress}% stamped
            </h2>
            <p className="mt-2 text-sm font-bold text-white/45">
              {visitedCount} of {activeGyms.length} active BGM gyms visited
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-3 text-orange-500">
            <Stamp size={26} strokeWidth={3} />
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{ width: `${passportProgress}%` }}
          />
        </div>

        <a
          href="/passport"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
        >
          Open Passport
          <ArrowRight size={17} strokeWidth={3} />
        </a>
      </section>

      {nextGym ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
                Suggested Gym
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {nextGym.name}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-white/45">
                {nextGym.address}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3 text-orange-500">
              <MapPinned size={26} strokeWidth={3} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href={`/gyms/${nextGym.id}`}
              className="flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-black text-black"
            >
              Details
            </a>

            <a
              href={nextGymMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/25 px-5 py-3 text-sm font-black text-white"
            >
              <Navigation size={16} strokeWidth={3} />
              Maps
            </a>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
            BGM Feed
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            What’s happening
          </h2>
        </div>

        <div className="grid gap-3">
          {feedItems.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.title}
                href={item.href}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500">
                    <Icon size={22} strokeWidth={3} />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
                      {item.label}
                    </p>
                    <h3 className="mt-2 text-lg font-black text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-white/45">
                      {item.text}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <a
              key={action.title}
              href={action.href}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition active:scale-95"
            >
              {action.trainer ? (
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-orange-500/50 bg-black">
                  <Image
                    src="/bgm-trainer-icon.png"
                    alt="BGM AI Trainer"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="inline-flex rounded-2xl bg-orange-500/10 p-3 text-orange-500">
                  <Icon size={22} strokeWidth={3} />
                </div>
              )}

              <h3 className="mt-4 text-lg font-black text-white">
                {action.title}
              </h3>
              <p className="mt-1 text-xs font-bold leading-5 text-white/40">
                {action.text}
              </p>
            </a>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/25 p-5 text-center">
        <MessageCircle className="mx-auto text-orange-500" size={26} strokeWidth={3} />
        <p className="mt-3 text-sm font-black uppercase tracking-[.2em] text-white/40">
          Be the best.... Beat the rest
        </p>
      </section>
    </div>
  );
}
