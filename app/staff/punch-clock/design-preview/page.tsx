"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, WifiOff, UserRound } from "lucide-react";

type Mode = "ready" | "in" | "out" | "unknown" | "offline";
const demo = { name: "Sarah Vella", number: "BGM-0012", gym: "BUILD Fitness", photo: "https://i.pravatar.cc/300?img=47" };
const stamp = "20/11/2026 • 08:32:14";

export default function PunchClockDesignPreview() {
  const [mode, setMode] = useState<Mode>("ready");
  const [seconds, setSeconds] = useState(5);
  useEffect(() => {
    if (mode === "ready") return;
    setSeconds(5);
    const interval = window.setInterval(() => setSeconds(value => value - 1), 1000);
    return () => window.clearInterval(interval);
  }, [mode]);
  useEffect(() => {
    if (seconds <= 0 && mode !== "ready") setMode("ready");
  }, [seconds, mode]);
  const success = mode === "in" || mode === "out";
  return (
    <main className="min-h-screen bg-[#090909] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-primary">BestGymsMalta</p>
            <h1 className="mt-1 text-2xl font-black">Staff Attendance</h1>
          </div>
          <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary">HU20 DESIGN DEMO</span>
        </div>
        <section aria-live="polite" className="flex min-h-[440px] flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-[#171717] px-5 py-10 text-center shadow-2xl">
          {mode === "ready" ? (
            <>
              <div className="flex h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <Fingerprint className="h-16 w-16 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-primary">Terminal ready</p>
              <h2 className="mt-3 text-4xl font-black">PLACE FINGER</h2>
              <p className="mt-4 max-w-sm text-zinc-400">Place your enrolled finger on the reader to clock in or out.</p>
            </>
          ) : success ? (
            <>
              <div className="mb-6 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-[#303030] shadow-[0_0_35px_rgba(255,180,0,0.18)] sm:h-44 sm:w-44">
                {demo.photo ? <img src={demo.photo} alt={demo.name} className="h-full w-full object-cover" /> : <UserRound className="h-20 w-20 text-primary" aria-hidden="true" />}
              </div>
              <h2 className="text-3xl font-black">{demo.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">Staff No. {demo.number}</p>
              <div className="mt-7 flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-6 py-4 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-bold">{mode === "in" ? "CLOCKED IN" : "CLOCKED OUT"}</span>
              </div>
              <p className="mt-4 text-4xl font-black tabular-nums text-primary">08:32:14</p>
              <p className="mt-2 text-sm text-zinc-300">{stamp.split(" • ")[0]} · {demo.gym}</p>
              <p className="mt-6 text-xs text-zinc-500">Returning to standby in {seconds}s</p>
            </>
          ) : (
            <>
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10">
                {mode === "offline" ? <WifiOff className="h-12 w-12 text-red-400" /> : <AlertTriangle className="h-12 w-12 text-red-400" />}
              </div>
              <h2 className="mt-7 text-3xl font-black">{mode === "offline" ? "READER UNAVAILABLE" : "FINGERPRINT NOT RECOGNISED"}</h2>
              <p className="mt-3 max-w-md text-zinc-400">{mode === "offline" ? "Check the reader connection and ask staff for assistance." : "Please try again using an enrolled finger."}</p>
              <p className="mt-6 text-xs text-zinc-500">Returning to standby in {seconds}s</p>
            </>
          )}
        </section>
        <div className="mt-5 rounded-2xl border border-white/10 bg-[#171717] p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Simulate a fingerprint result</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([["ready","Standby"],["in","Clock in"],["out","Clock out"],["unknown","Not recognised"],["offline","Reader offline"]] as const).map(([value,label]) => (
              <button key={value} type="button" onClick={() => setMode(value)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode === value ? "bg-primary text-zinc-950" : "border border-white/15 bg-white/5 text-white hover:border-primary/50"}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">Visual demonstration only. All staff details and times are fictional. No fingerprint capture, attendance recording, server requests or payroll actions are performed.</p>
      </div>
    </main>
  );
}
