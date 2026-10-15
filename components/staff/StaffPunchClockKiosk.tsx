"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, LoaderCircle, MapPin, ShieldAlert } from "lucide-react";

type TerminalSession = {
  terminal: { id: string; name: string; active: boolean };
  gym: { id: string; name: string; status: string };
};
type PunchResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  outcome?: "clocked_in" | "clocked_out" | "duplicate_ignored";
  message?: string | null;
  employee?: { firstName: string; surname: string; photoUrl: string | null };
  gym?: { id: string; name: string };
  effectiveAt?: string;
  dailyMinutes?: number;
};
type KioskState =
  | "loading"
  | "terminal_not_registered"
  | "hardware_not_configured"
  | "waiting"
  | "processing"
  | "clocked_in"
  | "clocked_out"
  | "duplicate"
  | "inactive"
  | "needs_attention"
  | "error";

function formatClock(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

function formatDate(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
}

function minutesLabel(value: number | undefined) {
  const total = Math.max(0, Number(value || 0));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${minutes}m today` : `${minutes}m today`;
}

export default function StaffPunchClockKiosk() {
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [state, setState] = useState<KioskState>("loading");
  const [now, setNow] = useState(()=>new Date());
  const [result, setResult] = useState<PunchResponse | null>(null);
  const [detail, setDetail] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTerminal = useCallback(async () => {
    setState("loading"); setDetail("");
    try {
      const response = await fetch("/api/staff-punch-clock/session", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setState(response.status === 401 ? "terminal_not_registered" : "error");
        setDetail(body.error || "Could not verify this Punch Clock terminal.");
        return;
      }
      setSession(body);
      setState("hardware_not_configured");
      setDetail("Fingerprint reader is not configured yet.");
    } catch {
      setState("error");
      setDetail("Could not connect to the Punch Clock service.");
    }
  }, []);

  useEffect(()=>{ void loadTerminal(); },[loadTerminal]);
  useEffect(()=>{
    const timer = window.setInterval(()=>setNow(new Date()),1000);
    return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>()=>{ if (resetTimer.current) clearTimeout(resetTimer.current); },[]);

  const submitFingerprintPayload = useCallback(async (payload: unknown) => {
    if (!session || state === "processing") return;
    setState("processing"); setDetail("Processing fingerprint…"); setResult(null);
    try {
      const response = await fetch("/api/staff-punch-clock/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const body: PunchResponse = await response.json();
      if (!response.ok) {
        setResult(body);
        if (body.code === "hardware_not_configured") setState("hardware_not_configured");
        else if (body.code === "inactive_employee" || body.code === "inactive_terminal") setState("inactive");
        else if (body.code === "invalid_request") setState("needs_attention");
        else setState("error");
        setDetail(body.error || "Punch could not be processed. Try again.");
        return;
      }

      setResult(body);
      if (body.outcome === "clocked_in") setState("clocked_in");
      else if (body.outcome === "clocked_out") setState("clocked_out");
      else if (body.outcome === "duplicate_ignored") setState("duplicate");
      else setState("needs_attention");

      if (body.outcome === "clocked_in" || body.outcome === "clocked_out") {
        resetTimer.current = setTimeout(()=>{
          setResult(null);
          setState("waiting");
          setDetail("Waiting for fingerprint…");
        }, 4500);
      }
    } catch {
      setState("error");
      setDetail("Punch Clock connection failed. Try again.");
    }
  }, [session, state]);

  useEffect(()=>{
    const listener = (event: Event) => {
      const biometricEvent = event as CustomEvent<unknown>;
      void submitFingerprintPayload(biometricEvent.detail);
    };
    window.addEventListener("bgm:staff-biometric-match", listener as EventListener);
    return ()=>window.removeEventListener("bgm:staff-biometric-match", listener as EventListener);
  }, [submitFingerprintPayload]);

  const status = useMemo(()=>{
    if (state === "clocked_in") return { title:"CLOCKED IN", text:"Attendance started successfully.", icon:<CheckCircle2 className="h-16 w-16"/> };
    if (state === "clocked_out") return { title:"CLOCKED OUT", text:"Attendance finished successfully.", icon:<CheckCircle2 className="h-16 w-16"/> };
    if (state === "duplicate") return { title:"Punch already recorded", text:result?.message || "Duplicate scan ignored safely.", icon:<ShieldAlert className="h-16 w-16"/> };
    if (state === "processing") return { title:"Processing", text:"Checking your fingerprint and attendance state…", icon:<LoaderCircle className="h-16 w-16 animate-spin"/> };
    if (state === "waiting") return { title:"Waiting for fingerprint", text:"Place your finger on the reader.", icon:<Fingerprint className="h-16 w-16"/> };
    if (state === "hardware_not_configured") return { title:"Hardware not configured", text:"Fingerprint reader is not configured. A real reader adapter must be installed before punches are accepted.", icon:<Fingerprint className="h-16 w-16"/> };
    if (state === "terminal_not_registered") return { title:"Terminal not registered", text:"This browser has not been provisioned as a Punch Clock terminal.", icon:<ShieldAlert className="h-16 w-16"/> };
    if (state === "inactive") return { title:"Attendance unavailable", text:detail || "Employee or terminal is inactive.", icon:<AlertTriangle className="h-16 w-16"/> };
    if (state === "needs_attention") return { title:"Needs attention", text:detail || "Please contact a manager.", icon:<AlertTriangle className="h-16 w-16"/> };
    if (state === "error") return { title:"Punch Clock unavailable", text:detail || "Try again.", icon:<AlertTriangle className="h-16 w-16"/> };
    return { title:"Loading Punch Clock", text:"Verifying this terminal…", icon:<LoaderCircle className="h-16 w-16 animate-spin"/> };
  },[state, detail, result]);

  const success = state === "clocked_in" || state === "clocked_out";
  const employee = result?.employee;

  return <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-8">
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-orange-400">BestGymsMalta</p><h1 className="mt-1 text-3xl font-black">Punch Clock</h1>{session && <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-300"><MapPin className="h-4 w-4 text-orange-400"/>{session.gym.name} · {session.terminal.name}</p>}</div>
        <div className="text-right"><p className="text-4xl font-black tabular-nums sm:text-5xl">{formatClock(now)}</p><p className="mt-1 text-sm text-zinc-400">{formatDate(now)}</p></div>
      </header>

      <section className={`my-auto rounded-[2rem] border p-7 text-center shadow-2xl sm:p-12 ${success ? "border-green-500/40 bg-green-500/10" : state === "hardware_not_configured" ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-white/[.04]"}`}>
        <div className={`mx-auto w-fit ${success ? "text-green-400" : state === "hardware_not_configured" ? "text-amber-400" : "text-orange-400"}`}>{status.icon}</div>
        <h2 className="mt-5 text-3xl font-black sm:text-5xl">{status.title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-300 sm:text-lg">{status.text}</p>

        {employee && <div className="mx-auto mt-7 flex max-w-xl items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">{employee.photoUrl ? <img src={employee.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover"/> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800 text-2xl font-black">{employee.firstName?.[0]}{employee.surname?.[0]}</div>}<div><p className="text-xl font-black">{employee.firstName} {employee.surname}</p><p className="mt-1 text-sm text-zinc-400">{result?.gym?.name || session?.gym.name}</p><p className="mt-1 font-bold text-orange-300">{minutesLabel(result?.dailyMinutes)}</p></div></div>}

        {(state === "error" || state === "terminal_not_registered" || state === "inactive" || state === "needs_attention") && <button onClick={()=>void loadTerminal()} className="mt-7 rounded-xl bg-white px-5 py-3 text-sm font-black text-zinc-950">Try again</button>}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-zinc-500"><span>Online-only attendance · Europe/Malta</span><span>No payroll information is shown on this terminal.</span></footer>
    </div>
  </main>;
}
