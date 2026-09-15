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
    <div data-member-surface="more-light" className="space-y-6 text-zinc-950">
      <section className="relative overflow-hidden rounded-[2rem] bg-zinc-950 p-6 shadow-xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">
            More
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white">
            Account & support
          </h1>
          <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-white/60">
            Everything for your membership, passport and support in one place.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]">
            <ShieldCheck size={27} strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#ff5a0a]">
              Member
            </p>
            <h2 className="mt-1 truncate text-2xl font-black text-zinc-950">
              {member ? member.fullName || member.username : "Not logged in"}
            </h2>
            <p className="mt-1 text-sm font-bold text-zinc-500">
              {member
                ? `${member.memberNumber} · ${member.status}`
                : "Log in to access your member features."}
            </p>
          </div>
        </div>

        {!member ? (
          <a
            href="/member-login"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100"
          >
            <LogIn size={17} strokeWidth={3} />
            Login / Activate
          </a>
        ) : null}
      </section>

      <section className="space-y-3">
        <a
          href="/passport"
          className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]">
              <Stamp size={25} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-zinc-950">Passport</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-zinc-500">
                View your gym stamps and passport progress.
              </p>
            </div>
          </div>
          <ChevronRight className="shrink-0 text-zinc-300" size={20} strokeWidth={3} />
        </a>

        <a
          href="/member-login"
          className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
              <UserCircle size={25} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-zinc-950">Account</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-zinc-500">
                Check your login, membership and app account.
              </p>
            </div>
          </div>
          <ChevronRight className="shrink-0 text-zinc-300" size={20} strokeWidth={3} />
        </a>

        <a
          href={FACEBOOK_MESSENGER_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-orange-200 bg-orange-50 p-5"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#ff5a0a] text-white">
              <MessageCircle size={25} strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-zinc-950">Contact BGM</h3>
              <p className="mt-1 text-sm font-bold leading-5 text-zinc-600">
                Message BestGymsMalta directly on Messenger.
              </p>
            </div>
          </div>
          <ChevronRight className="shrink-0 text-[#ff5a0a]" size={20} strokeWidth={3} />
        </a>

        {member ? (
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-between gap-4 rounded-[1.7rem] border border-red-200 bg-red-50 p-5 text-left"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <LogOut size={25} strokeWidth={3} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-red-700">Logout</h3>
                <p className="mt-1 text-sm font-bold leading-5 text-red-500">
                  Sign out of this member account.
                </p>
              </div>
            </div>
            <ChevronRight className="shrink-0 text-red-300" size={20} strokeWidth={3} />
          </button>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <Sparkles className="mx-auto text-[#ff5a0a]" size={28} strokeWidth={3} />
        <p className="mt-3 text-xs font-black uppercase tracking-[.24em] text-[#ff5a0a]">
          Be the best... Beat the rest
        </p>
        <p className="mt-2 text-sm font-bold text-zinc-400">
          BestGymsMalta member app
        </p>
      </section>
    </div>
  );
}
