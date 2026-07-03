"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Dumbbell, MapPinned, RefreshCw } from "lucide-react";
import type { Gym } from "@/components/data/gyms";
import { getSavedMember, type AppMember } from "@/lib/memberSession";

export default function CheckInPage({ gymId }: { gymId: string }) {
  const [gym, setGym] = useState<Gym | null>(null);
  const [member, setMember] = useState<AppMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    setMember(getSavedMember());

    async function loadGym() {
      try {
        const response = await fetch("/api/gyms", {
          cache: "no-store",
        });

        const data = await response.json();
        const foundGym = (data.gyms || []).find((item: Gym) => item.id === gymId);

        setGym(foundGym || null);
      } catch {
        setGym(null);
      } finally {
        setLoading(false);
      }
    }

    loadGym();
  }, [gymId]);

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
          className="mt-5 flex items-center justify-center rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
        >
          View Gyms
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/20 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
                BGM Check-in
              </p>

              <h1 className="mt-4 text-4xl font-black leading-tight text-white">
                {gym.name}
              </h1>
            </div>

            {gym.logo ? (
              <img
                src={gym.logo}
                alt=""
                className="h-20 w-20 shrink-0 object-contain"
              />
            ) : null}
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-6 text-white/55">
            <MapPinned className="mt-0.5 text-orange-500" size={17} />
            {gym.address}
          </p>
        </div>
      </section>

      {!member ? (
        <section className="rounded-[2rem] border border-orange-500/30 bg-orange-500/10 p-5 text-center">
          <h2 className="text-2xl font-black text-white">Login required</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Please log in or activate your account before checking in. This
            connects the stamp to your own member passport.
          </p>

          <a
            href="/member-login"
            className="mt-5 flex items-center justify-center rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            Login / Activate
          </a>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
          {checkedIn ? (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-400/10 text-green-300">
              <CheckCircle2 size={42} strokeWidth={3} />
            </div>
          ) : (
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Dumbbell size={38} strokeWidth={3} />
            </div>
          )}

          <h2 className="mt-5 text-2xl font-black text-white">
            {checkedIn ? "Passport stamped" : "Confirm your visit"}
          </h2>

          <p className="mt-2 text-xs font-black uppercase tracking-[.18em] text-orange-500">
            {member.fullName || member.username} · {member.memberNumber}
          </p>

          <p className="mt-3 text-sm font-bold leading-6 text-white/50">
            {message ||
              "Tap below to confirm your check-in and add this gym to your passport."}
          </p>

          {!checkedIn ? (
            <button
              type="button"
              onClick={confirmCheckIn}
              disabled={saving || gym.status !== "active"}
              className="mt-5 w-full rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black disabled:opacity-40"
            >
              {saving ? "Checking in…" : "Confirm Check-in"}
            </button>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <a
                href="/passport"
                className="rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
              >
                Passport
              </a>

              <a
                href="/story"
                className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-white"
              >
                Share Story
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
