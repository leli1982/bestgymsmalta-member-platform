"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  LogIn,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stamp,
  UserCircle,
} from "lucide-react";
import {
  clearSavedMember,
  getSavedMember,
  type AppMember,
} from "@/lib/memberSession";

const FACEBOOK_MESSENGER_URL = "https://m.me/bestgymsmalta";

export default function MorePage() {
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

  function logout() {
    clearSavedMember();
    setMember(null);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-orange-500/25 via-white/[0.04] to-black p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.25em] text-orange-500">
            More
          </p>

          <h1 className="mt-4 text-4xl font-black leading-tight text-white">
            Account & support
          </h1>

          <p className="mt-3 text-sm font-bold leading-6 text-white/55">
            Access your passport, account, contact options and logout.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-orange-500" size={26} strokeWidth={3} />

          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-orange-500">
              Member
            </p>

            <h2 className="mt-1 text-2xl font-black text-white">
              {member ? member.fullName || member.username : "Not logged in"}
            </h2>

            <p className="mt-1 text-sm font-bold text-white/45">
              {member
                ? `${member.memberNumber} · ${member.status}`
                : "Log in to access your member features."}
            </p>
          </div>
        </div>

        {!member ? (
          <a
            href="/member-login"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black"
          >
            <LogIn size={17} strokeWidth={3} />
            Login / Activate
          </a>
        ) : null}
      </section>

      <section className="space-y-3">
        <a
          href="/passport"
          className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <Stamp size={26} strokeWidth={3} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Passport</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-white/45">
                View your gym stamps and passport progress.
              </p>
            </div>
          </div>

          <ChevronRight
            className="shrink-0 text-white/35"
            size={20}
            strokeWidth={3}
          />
        </a>

        <a
          href="/member-login"
          className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <UserCircle size={26} strokeWidth={3} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Account</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-white/45">
                Check your login, membership and app account.
              </p>
            </div>
          </div>

          <ChevronRight
            className="shrink-0 text-white/35"
            size={20}
            strokeWidth={3}
          />
        </a>

        <a
          href={FACEBOOK_MESSENGER_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-4 rounded-[2rem] border border-orange-500/30 bg-orange-500/10 p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-black">
              <MessageCircle size={26} strokeWidth={3} />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Contact BGM</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-white/50">
                Message BestGymsMalta directly on Messenger.
              </p>
            </div>
          </div>

          <ChevronRight
            className="shrink-0 text-white/35"
            size={20}
            strokeWidth={3}
          />
        </a>

        {member ? (
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-between gap-4 rounded-[2rem] border border-red-500/30 bg-red-500/10 p-5 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
                <LogOut size={26} strokeWidth={3} />
              </div>

              <div>
                <h3 className="text-lg font-black text-red-300">Logout</h3>
                <p className="mt-1 text-sm font-bold leading-5 text-white/45">
                  Sign out of this member account.
                </p>
              </div>
            </div>

            <ChevronRight
              className="shrink-0 text-white/35"
              size={20}
              strokeWidth={3}
            />
          </button>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-black/25 p-5 text-center">
        <Sparkles className="mx-auto text-orange-500" size={28} strokeWidth={3} />
        <p className="mt-3 text-xs font-black uppercase tracking-[.24em] text-orange-500">
          Be the best... Beat the rest
        </p>
        <p className="mt-2 text-sm font-bold text-white/40">
          BestGymsMalta member app
        </p>
      </section>
    </div>
  );
}
