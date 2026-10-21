"use client";

import { formatEuropeanDate } from "@/lib/europeanDate";
import { resolveMembershipTheme } from "@/lib/membershipTheme";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import {
  cacheVerifiedMember, forgetSavedMember,
  MEMBER_SESSION_KEY, waitForMemberLogout,
} from "@/lib/memberSession";
import { resolveMemberCardResponse, type MemberCardState } from "@/lib/memberCardState";
import MemberBarcode from "@/components/member/MemberBarcode";
import GoogleWalletButton from "@/components/member/GoogleWalletButton";

type MemberCardProps = {
  variant?: "full" | "home";
};

function premiumCardOverlay(themeColor: string) {
  return `linear-gradient(180deg, ${themeColor}33 0%, ${themeColor}4D 52%, rgba(0,0,0,.68) 100%)`;
}

function PremiumArtwork({ themeColor }: { themeColor: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
      <img
        src="/api/wallet-assets/card-background?v=2"
        alt=""
        className="absolute inset-0 h-full w-full object-contain object-top"
      />
      <div className="absolute inset-0" style={{ background: premiumCardOverlay(themeColor) }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5" />
    </div>
  );
}

export default function MemberCard({ variant = "full" }: MemberCardProps) {
  const [state, setState] = useState<MemberCardState>({ kind: "loading" });
  const [flipped, setFlipped] = useState(false);
  const requestVersion = useRef(0);

  const loadCardCredential = useCallback(async () => {
    const version = ++requestVersion.current;
    setState({ kind: "loading" });
    setFlipped(false);
    try {
      await waitForMemberLogout();
      if (version !== requestVersion.current) return;
      const response = await fetch("/api/member/card", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);
      if (version !== requestVersion.current) return;
      const nextState = resolveMemberCardResponse(response.status, data);
      setState(nextState);
      if (nextState.kind === "signed-out") forgetSavedMember();
      if (nextState.kind === "ready") cacheVerifiedMember(nextState.member);
    } catch {
      if (version !== requestVersion.current) return;
      setState({ kind: "unavailable", message: "Your card could not be loaded. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    function onMemberChanged(event: Event) {
      if ((event as CustomEvent<{ signedOut?: boolean }>).detail?.signedOut) {
        requestVersion.current += 1;
        setFlipped(false);
        setState({ kind: "signed-out" });
        return;
      }
      void loadCardCredential();
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== MEMBER_SESSION_KEY && event.key !== null) return;
      if (event.newValue === null) {
        requestVersion.current += 1;
        setFlipped(false);
        setState({ kind: "signed-out" });
      } else void loadCardCredential();
    }
    function refreshOnFocus() { void loadCardCredential(); }

    void loadCardCredential();
    window.addEventListener("bgmMemberChanged", onMemberChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("bgmMemberChanged", onMemberChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadCardCredential]);

  if (state.kind !== "ready") {
    const signingIn = state.kind === "signed-out";
    const loading = state.kind === "loading";
    return (
      <section
        data-home-membership={variant === "home" ? "compact-strip" : undefined}
        className="rounded-[1.45rem] border border-zinc-200/80 bg-white p-5 text-zinc-950 shadow-[0_6px_20px_rgba(15,23,42,0.06)]"
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 p-2">
            <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">Membership</p>
            <h2 className="mt-1 text-base font-black">
              {loading ? "Checking your card…" : signingIn ? "Sign in to show your card" : "Card temporarily unavailable"}
            </h2>
          </div>
        </div>
        {!loading && (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {signingIn
              ? "Please sign in to confirm your session and load your current card."
              : state.kind === "unavailable" ? state.message : ""}
          </p>
        )}
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw size={15} className="animate-spin" /> Loading your current membership…
          </p>
        ) : signingIn ? (
          <a href="/member-login?returnTo=card"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white">
            <LogIn size={17} /> Sign in
          </a>
        ) : (
          <button type="button" onClick={() => void loadCardCredential()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff5a0a] px-5 py-3 text-sm font-black text-white">
            <RefreshCw size={17} /> Try again
          </button>
        )}
      </section>
    );
  }

  const { member, cardLinked, cardBarcode } = state;
  const assignedCardNumber = cardLinked ? cardBarcode || "" : "";
  const active = member.status === "active"
    && (!member.membershipExpiry || member.membershipExpiry.slice(0, 10) >= new Date().toISOString().slice(0, 10));
  const expiryText = member.membershipExpiry
    ? formatEuropeanDate(member.membershipExpiry)
    : "Not set";
  const theme = resolveMembershipTheme(member.membershipType);

  if (variant === "home") {
    return (
      <button
        type="button"
        data-home-membership="compact-strip"
        onClick={() => setFlipped((value) => !value)}
        className="block w-full text-left"
        style={{ perspective: "1200px" }}
        aria-label="Flip membership card"
      >
        <div
          className="relative min-h-[160px] transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <section
            className="absolute inset-0 overflow-hidden rounded-[1.55rem] border p-4 text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
            style={{ backfaceVisibility: "hidden", borderColor: theme.border, backgroundColor: theme.background }}
          >
            <PremiumArtwork themeColor={theme.background} />
            <div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_minmax(112px,.9fr)] gap-4">
              <div className="flex min-w-0 flex-col justify-between border-r border-white/20 pr-3">
                <div>
                  <div className="relative h-7 w-36">
                    <Image src="/wallet/bgm-logo-white.png" alt="BestGymsMalta" fill className="object-contain object-left" />
                  </div>
                  <p className="mt-2 text-[9px] font-black uppercase tracking-[.18em] text-white/70">{theme.label} membership</p>
                  <h2 className="mt-1 truncate text-[15px] font-black leading-tight">{member.fullName || member.username}</h2>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[.12em] text-white/55">Valid until</p>
                    <p className="mt-0.5 text-[10px] font-black">{expiryText}</p>
                  </div>
                  <p className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[.08em] ${active ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-50" : "border-amber-300/40 bg-amber-300/15 text-amber-50"}`}>
                    {active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col justify-center text-center">
                <div className="rounded-xl bg-white px-2 py-1.5 text-zinc-950 shadow-sm [&>div]:p-0 [&_p]:mt-0 [&_p]:text-[7px] [&_p]:tracking-[.08em] [&_svg]:max-h-[48px]">
                  {assignedCardNumber ? <MemberBarcode memberNumber={assignedCardNumber} /> : <p className="py-4 text-[9px] font-bold text-amber-700">Card not assigned</p>}
                </div>
                <p className="mt-2 truncate font-mono text-[10px] font-black text-white">{member.memberNumber}</p>
                <p className="mt-1 text-[7px] font-bold uppercase tracking-[.12em] text-white/55">Tap for details</p>
              </div>
            </div>
          </section>

          <section
            className="absolute inset-0 overflow-hidden rounded-[1.55rem] border p-4 text-white shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: theme.border, backgroundColor: theme.background }}
          >
            <PremiumArtwork themeColor={theme.background} />
            <div className="relative z-10 flex h-full items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-white/65">{theme.label} Member Details</p>
                <h2 className="mt-1 truncate text-base font-black">{member.fullName || member.username}</h2>
                <p className="mt-2 text-[8px] font-semibold uppercase tracking-[.12em] text-white/50">BGM member number</p>
                <p className="truncate text-xs font-black">{member.memberNumber}</p>
                <p className="mt-1 text-[9px] font-semibold text-white/65">Current card: {assignedCardNumber || "Not assigned"}</p>
                <p className="mt-1 text-[9px] font-semibold text-white/65">Valid until {expiryText}</p>
              </div>
              <ShieldCheck className="shrink-0 text-white" size={29} strokeWidth={3} />
            </div>
          </section>
        </div>
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setFlipped((value) => !value)}
        className="block w-full text-left" style={{ perspective: "1200px" }}
        aria-label={flipped ? "Show membership barcode" : "Show membership details"}>
        <div className="grid transition-transform duration-700 motion-reduce:transition-none"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <section
            className="relative col-start-1 row-start-1 flex min-h-[500px] flex-col justify-between overflow-hidden rounded-[2rem] border p-6 text-white shadow-[0_22px_55px_rgba(0,0,0,0.30)]"
            style={{ backfaceVisibility: "hidden", borderColor: theme.border, backgroundColor: theme.background }} aria-hidden={flipped}>
            <PremiumArtwork themeColor={theme.background} />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="relative h-10 w-64 max-w-full">
                    <Image src="/wallet/bgm-logo-white.png" alt="BestGymsMalta" fill priority className="object-contain object-left" />
                  </div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[.2em] text-white/65">{theme.label} membership</p>
                  <h2 className="mt-2 break-words text-[1.8rem] font-black leading-[1.06] tracking-[-.025em]">{member.fullName || member.username}</h2>
                  <p className="mt-3 font-mono text-base font-black tracking-[.04em] text-white/90">{member.memberNumber}</p>
                </div>
                <div className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-white/85 backdrop-blur-sm">
                  {active ? "Active" : "Inactive"}
                </div>
              </div>

              <p className="mt-5 max-w-[16rem] text-lg font-medium leading-tight tracking-[-.02em] text-white/85">Be the best, beat the rest</p>

              <div className="mt-6 rounded-[1.35rem] border border-white/20 bg-white p-3 text-zinc-950 shadow-[0_10px_30px_rgba(0,0,0,.22)]">
                {assignedCardNumber ? <MemberBarcode memberNumber={assignedCardNumber} /> : <p className="py-9 text-center text-sm font-bold text-amber-700">Card not assigned. Staff can still find you using your BGM membership number.</p>}
              </div>
              <p className="mt-2.5 text-center text-[10px] font-semibold text-white/60">
                {assignedCardNumber ? "Present this current card barcode at reception." : "Ask staff to assign a card at reception."}
              </p>
            </div>

            <div className="relative z-10 mt-6 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.13em] text-white/50">Membership type</p>
                <p className="mt-1 text-xs font-black">{theme.label}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.13em] text-white/50">Status</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-black">
                  <BadgeCheck size={15} /> {active ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold uppercase tracking-[.13em] text-white/50">Valid until</p>
                <p className="mt-1 text-xs font-black">{expiryText}</p>
              </div>
            </div>
            <p className="relative z-10 mt-4 text-center text-[9px] font-bold uppercase tracking-[.12em] text-white/45">Tap card to view details</p>
          </section>

          <section
            className="relative col-start-1 row-start-1 flex min-h-[500px] flex-col justify-between overflow-hidden rounded-[2rem] border p-6 text-white shadow-[0_22px_55px_rgba(0,0,0,0.30)]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: theme.border, backgroundColor: theme.background }} aria-hidden={!flipped}>
            <PremiumArtwork themeColor={theme.background} />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-4">
                <div className="relative h-9 w-36">
                  <Image src="/wallet/bgm-logo-white.png" alt="BestGymsMalta" fill className="object-contain object-left" />
                </div>
                <ShieldCheck className="text-white" size={25} />
              </div>
              <p className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-white/60">{theme.label} Member details</p>
              <dl className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
                  <dt className="text-[10px] font-semibold text-white/55">Name</dt>
                  <dd className="mt-1 break-words text-lg font-black">{member.fullName || member.username}</dd>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
                  <dt className="text-[10px] font-semibold text-white/55">BGM member number</dt>
                  <dd className="mt-1 break-all font-mono text-base font-black">{member.memberNumber}</dd>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm">
                  <dt className="text-[10px] font-semibold text-white/55">Current card number</dt>
                  <dd className="mt-1 break-all font-mono text-sm font-black">{assignedCardNumber || "Not assigned"}</dd>
                  {!cardLinked && <p className="mt-2 text-xs text-white/55">Physical card not linked</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm"><dt className="text-[10px] text-white/55">Valid until</dt><dd className="mt-1 text-sm font-bold">{expiryText}</dd></div>
                  <div className="min-w-0 rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm"><dt className="text-[10px] text-white/55">Email</dt><dd className="mt-1 break-all text-xs font-bold">{member.email || "Not set"}</dd></div>
                </div>
              </dl>
            </div>
            <div className="relative z-10 mt-5">
              <p className="text-base font-medium text-white/80">Be the best, beat the rest</p>
              <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[.12em] text-white/45">Tap card to return to your barcode</p>
            </div>
          </section>
        </div>
      </button>
      <GoogleWalletButton />
    </>
  );
}
