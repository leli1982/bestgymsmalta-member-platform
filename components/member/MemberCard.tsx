"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import {
  cacheVerifiedMember, forgetSavedMember,
  MEMBER_SESSION_KEY, waitForMemberLogout,
} from "@/lib/memberSession";
import { resolveMemberCardResponse, type MemberCardState } from "@/lib/memberCardState";
import MemberBarcode from "@/components/member/MemberBarcode";

type MemberCardProps = {
  variant?: "full" | "home";
};

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
      // Treat authentication failures correctly even if an error body is empty.
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
      // Local state can revoke the displayed card, but can never authorise it.
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

    // A valid cookie works even if localStorage has been cleared.
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

  const { member, cardLinked, cardBarcode, physicalCardBarcode } = state;
  const assignedCardNumber = cardLinked ? cardBarcode || "" : "";
  const active = member.status === "active"
    && (!member.membershipExpiry || member.membershipExpiry.slice(0, 10) >= new Date().toISOString().slice(0, 10));
  const expiryText = member.membershipExpiry
    ? new Date(member.membershipExpiry).toLocaleDateString()
    : "Not set";

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
          className="relative min-h-[142px] transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <section
            className="absolute inset-0 overflow-hidden rounded-[1.45rem] border border-zinc-200/80 bg-white p-3 text-zinc-950 shadow-[0_7px_24px_rgba(15,23,42,0.07)]"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="grid h-full grid-cols-[72px_minmax(0,.9fr)_minmax(108px,1.2fr)] items-center gap-3">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[1rem] bg-zinc-950 p-2.5">
                <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-full w-full object-contain" />
              </div>

              <div className="min-w-0 border-r border-slate-200 pr-2">
                <p className="text-[10px] font-bold text-slate-500">Membership</p>
                <p className={`mt-1 flex items-center gap-1.5 text-[13px] font-black capitalize ${active ? "text-emerald-700" : "text-amber-700"}`}>
                  <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {member.status || "Active"}
                </p>
                <p className="mt-2 text-[9px] font-semibold text-slate-400">Valid until</p>
                <p className="truncate text-[10px] font-black text-zinc-900">{expiryText}</p>
              </div>

              <div className="min-w-0 text-center">
                <div className="[&>div]:p-0 [&_p]:mt-0 [&_p]:text-[8px] [&_p]:tracking-[.08em] [&_svg]:max-h-[48px]">
                  {assignedCardNumber ? <MemberBarcode memberNumber={assignedCardNumber} /> : <p className="py-4 text-[10px] font-bold text-amber-700">Card not assigned</p>}
                </div>
                <p className="mt-1 truncate font-mono text-[10px] font-black text-zinc-950">{member.memberNumber}</p>
                <p className="mt-1 text-[8px] font-semibold text-slate-500">{assignedCardNumber ? "Current card: " + assignedCardNumber : "BGM member number · tap for details"}</p>
              </div>
            </div>
            
          </section>

          <section
            className="absolute inset-0 overflow-hidden rounded-[1.45rem] border border-zinc-200/80 bg-white p-4 text-zinc-950 shadow-[0_7px_24px_rgba(15,23,42,0.07)]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="flex h-full items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#ff5a0a]">Member Details</p>
                <h2 className="mt-1 truncate text-base font-black">{member.fullName || member.username}</h2>
                <p className="mt-2 text-[9px] font-semibold text-slate-400">BGM member number</p>
                <p className="truncate text-xs font-black">{member.memberNumber}</p>
                <p className="mt-1 text-[9px] font-semibold text-slate-500">Current card: {assignedCardNumber || "Not assigned"}</p>
                <p className="mt-1 text-[9px] font-semibold text-slate-400">Valid until {expiryText}</p>
              </div>
              <ShieldCheck className="shrink-0 text-[#ff5a0a]" size={29} strokeWidth={3} />
            </div>
          </section>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={() => setFlipped((value) => !value)}
      className="block w-full text-left text-zinc-950" style={{ perspective: "1200px" }}
      aria-label={flipped ? "Show membership barcode" : "Show membership details"}>
      <div className="grid transition-transform duration-700 motion-reduce:transition-none"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <section
          className="relative col-start-1 row-start-1 flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.07)]"
          style={{ backfaceVisibility: "hidden" }} aria-hidden={flipped}>
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#ff5a0a]" />
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#c2410c]">BestGymsMalta</p>
                <h2 className="mt-3 break-words text-2xl font-black leading-tight">{member.fullName || member.username}</h2>
                <p className="mt-2 text-xs font-bold text-slate-500">Digital membership card</p>
                <p className="mt-2 font-mono text-lg font-black text-[#c2410c]">{member.memberNumber}</p>
              </div>
              <div className="relative h-16 w-16 shrink-0 rounded-full bg-zinc-950 p-2">
                <Image src="/bgm-logo.png" alt="BestGymsMalta" fill priority className="object-contain p-2" />
              </div>
            </div>
            <div className="mt-7 rounded-2xl border border-zinc-200 bg-white p-2">
              {assignedCardNumber ? <MemberBarcode memberNumber={assignedCardNumber} /> : <p className="py-9 text-center text-sm font-bold text-amber-700">Card not assigned. Staff can still find you using your BGM membership number.</p>}
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              {assignedCardNumber ? "Present this current card barcode at reception." : "Ask staff to assign a card at reception."}
            </p>
          </div>
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4">
              <div className={`flex items-center gap-2 ${active ? "text-emerald-700" : "text-amber-700"}`}>
                <BadgeCheck size={21} />
                <p className="text-xs font-black capitalize">{active ? "Active member" : "Inactive / expired"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">Valid until</p>
                <p className="mt-1 text-xs font-black">{expiryText}</p>
              </div>
            </div>
            <p className="mt-5 text-center text-[10px] font-bold text-slate-500">Tap card to view details</p>
          </div>
        </section>
        <section
          className="col-start-1 row-start-1 flex min-h-[420px] flex-col justify-between rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.07)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }} aria-hidden={!flipped}>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#c2410c]">Member details</p>
              <ShieldCheck className="text-[#ff5a0a]" size={25} />
            </div>
            <dl className="mt-5 space-y-4">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <dt className="text-xs font-semibold text-slate-500">Name</dt>
                <dd className="mt-1 break-words text-lg font-black">{member.fullName || member.username}</dd>
              </div>
              <div className="rounded-2xl bg-orange-50 p-4">
                <dt className="text-xs font-semibold text-slate-500">BGM member number</dt>
                <dd className="mt-1 break-all font-mono text-lg font-black text-[#c2410c]">{member.memberNumber}</dd>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <dt className="text-xs font-semibold text-slate-500">Current card number</dt>
                <dd className="mt-1 break-all font-mono text-sm font-black">{assignedCardNumber || "Not assigned"}</dd>
                {!cardLinked && <p className="mt-2 text-xs text-slate-500">Physical card not linked</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-slate-500">Valid until</dt><dd className="mt-1 text-sm font-bold">{expiryText}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all text-xs font-bold">{member.email || "Not set"}</dd></div>
              </div>
            </dl>
          </div>
          <p className="mt-5 text-center text-[10px] font-bold text-slate-500">Tap card to return to your barcode</p>
        </section>
      </div>
    </button>
  );
}
