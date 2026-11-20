"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Fingerprint, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";

type ServiceState = "checking" | "configured" | "unavailable";
const BRIDGE = "http://127.0.0.1:8765";
const BRIDGE_HEADERS = { "X-BGM-HU20-Bridge": "v1" };

export default function StaffPunchClockInformation() {
  const [enabled,setEnabled] = useState<boolean | null>(null);
  const [service,setService] = useState<ServiceState>("checking");

  const checkStatus = useCallback(async()=>{
    setService("checking");
    try {
      const response = await fetch(BRIDGE+"/status",{method:"GET",headers:BRIDGE_HEADERS,cache:"no-store"});
      const data = await response.json();
      // This confirms the locally provisioned service, not a live fingerprint.
      // Actual SDK health, terminal authorisation and attendance are checked
      // independently by the Windows application and TEST server.
      setService(response.ok && data?.ok===true && data?.testOnly===true ? "configured" : "unavailable");
    } catch { setService("unavailable"); }
  },[]);

  useEffect(()=>{
    let mounted=true;
    void fetch("/api/staff-hu20/portal-capability",{cache:"no-store"})
      .then(async response=>response.ok?response.json():null)
      .then(body=>{if(mounted)setEnabled(body?.punchClockEnabled===true);})
      .catch(()=>{if(mounted)setEnabled(false);});
    void checkStatus();
    return ()=>{mounted=false;};
  },[checkStatus]);

  return <main className="min-h-screen bg-[#090909] px-4 py-6 text-white sm:p-8">
    <div className="mx-auto max-w-4xl">
      <a href="/staff" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
        <ArrowLeft className="h-4 w-4"/> Staff Portal
      </a>
      <div className="mt-6 rounded-3xl border border-white/10 bg-[#141414] p-6 shadow-2xl shadow-black/40 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-primary">BestGymsMalta · HU20</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Staff Punch Clock</h1>
          </div>
          <span className="rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-200">
            ISOLATED TEST PILOT
          </span>
        </div>

        {enabled === null ? <p role="status" className="mt-6 text-lg">Checking this gym's Punch Clock setting…</p> :
        !enabled ? <div className="mt-7 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-5">
          <div className="flex items-center gap-3"><ShieldAlert className="h-7 w-7 text-amber-200"/>
            <h2 className="text-xl font-black">Punch Clock not enabled for this gym</h2></div>
          <p className="mt-2 text-sm text-zinc-200">Ask Super Admin to enable the TEST pilot for this gym. No fingerprint attendance can be recorded here while it is off.</p>
        </div> :
        <>
          <div className="mt-8 rounded-3xl border border-white/20 bg-[#1b1b1b] p-6 text-center sm:p-9">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <Fingerprint className="h-14 w-14 text-orange-200" aria-hidden="true"/>
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-orange-200">Staff instructions — not the scanner</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">READY FOR YOUR FINGERPRINT</h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-zinc-200">
              After Super Admin approves a TEST window, the installed Windows kiosk opens and displays
              <strong> PLACE FINGER</strong>. Place an enrolled finger on that physical reader.
              The Windows kiosk then shows CLOCKED IN or CLOCKED OUT once the server confirms attendance.
            </p>
            <p className="mt-4 text-sm font-bold text-white">
              No PIN, barcode or manual clock-in / clock-out selection is required.
            </p>
            <p role="note" className="mt-3 text-sm text-amber-200">
              This browser is an information screen. An installed HU20 service alone does not mean the
              physical scanner is plugged in or an approved kiosk window is running.
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#202020] p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-300"/>
              <h3 className="mt-2 text-xl font-black text-primary">CLOCKED IN</h3>
              <p className="mt-1 text-sm text-zinc-300">Green confirmation on the Windows kiosk after a successful first punch.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-300"/>
              <h3 className="mt-2 text-xl font-black text-primary">CLOCKED OUT</h3>
              <p className="mt-1 text-sm text-zinc-300">Green confirmation after the next authorised punch.</p>
            </div>
          </div>
        </>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#202020] p-4">
          <div className="flex items-center gap-3">
            {service==="configured" ? <CheckCircle2 className="h-6 w-6 text-emerald-300"/> :
              <WifiOff className="h-6 w-6 text-amber-300"/>}
            <div>
              <p role="status" className="font-black">
                {service==="checking"?"Checking this PC's reader service…" :
                  service==="configured"?"Configured HU20 service detected on this PC":"No configured HU20 service detected on this PC"}
              </p>
              <p className="text-xs text-zinc-300">
                This checks the local helper only—not hardware availability or an active TEST scan window.
                Fingerprint capture and attendance are handled by the installed Windows kiosk.
              </p>
            </div>
          </div>
          <button type="button" onClick={()=>void checkStatus()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-zinc-950 transition hover:brightness-110">
            <RefreshCw className="h-4 w-4"/> Check service
          </button>
        </div>
        <p className="mt-5 text-xs text-zinc-300">
          TEST attendance requires a separately approved, time-limited kiosk session and an individually authorised employee.
          The browser screen does not scan fingerprints or record punches. Production activation remains disabled.
        </p>
      </div>
    </div>
  </main>;
}
