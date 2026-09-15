"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, RefreshCcw, UserRound } from "lucide-react";
import StaffMembershipReviewModal from "@/components/staff/StaffMembershipReviewModal";

type QueueParticipant = {
  id: string;
  participantOrder: number;
  fullName: string;
  hasPhoto: boolean;
  cardAssigned: boolean;
  reservedBarcode: string | null;
};

type QueueApplication = {
  id: string;
  reference: string;
  kind: "new" | "renewal";
  status: "submitted" | "awaiting_payment";
  membershipType: string;
  enrollmentGymId: string;
  enrollmentGymName: string;
  submittedAt: string | null;
  createdAt: string;
  participants: QueueParticipant[];
};

type Props = {
  refreshToken?: number;
  onCountChange?: (count: number) => void;
};

function formatSubmitted(value: string | null, fallback: string) {
  const source = value || fallback;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "Submitted";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function StaffMembershipQueue({ refreshToken = 0, onCountChange }: Props) {
  const [applications, setApplications] = useState<QueueApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertsArmed, setAlertsArmed] = useState(false);
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);

  const playArrival = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const context = audioContext.current || new Ctx();
      audioContext.current = context;
      if (context.state === "suspended") void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch {
      // Visual queue/popup remains authoritative if browser audio is unavailable.
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/system/members/applications", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load waiting applications.");
      const next = (data.applications || []) as QueueApplication[];
      setApplications(next);
      onCountChange?.(next.length);
      setError("");

      if (!initialized.current) {
        next.forEach((item) => seenIds.current.add(item.id));
        initialized.current = true;
      } else {
        const unseen = next.filter((item) => !seenIds.current.has(item.id));
        next.forEach((item) => seenIds.current.add(item.id));
        if (unseen.length > 0) {
          if (alertsArmed) playArrival();
          setSelectedId((current) => current || unseen[0].id);
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load waiting applications.");
    } finally {
      setLoading(false);
    }
  }, [alertsArmed, onCountChange, playArrival]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue, refreshToken]);

  useEffect(() => {
    const recover = () => void loadQueue();
    const interval = window.setInterval(recover, 30_000);
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
    };
  }, [loadQueue]);

  async function armAlerts() {
    setAlertsArmed(true);
    try {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const context = audioContext.current || new Ctx();
        audioContext.current = context;
        await context.resume();
      }
    } catch {
      // Keep visual notifications enabled even if audio cannot be armed.
    }
  }

  async function handleChanged() {
    await loadQueue();
  }

  return (
    <section id="staff-waiting" className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#ff5a0a]"><Bell className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">New membership queue</p>
            <h2 className="text-xl font-black text-zinc-950">{applications.length} WAITING</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!alertsArmed && (
            <button type="button" onClick={() => void armAlerts()} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">
              Enable alerts
            </button>
          )}
          {error && (
            <button type="button" onClick={() => void loadQueue()} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <RefreshCcw className="h-4 w-4" /> Retry
            </button>
          )}
        </div>
      </div>

      {error && <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 sm:mx-6">{error}</div>}
      <div className="divide-y divide-zinc-100">
        {!loading && applications.length === 0 && !error && (
          <div className="p-8 text-center text-sm font-medium text-zinc-500">No membership applications are waiting at this gym.</div>
        )}
        {applications.map((application) => (
          <button
            type="button"
            key={application.id}
            onClick={() => setSelectedId(application.id)}
            className="grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50 sm:px-6"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500"><UserRound className="h-6 w-6" /></span>
            <span className="min-w-0">
              <span className="block truncate font-black text-zinc-950">{application.participants.map((p) => p.fullName).join(" & ") || application.reference}</span>
              <span className="mt-1 block truncate text-sm text-zinc-500">
                {application.kind === "renewal" ? "Renewal" : "New membership"} · {formatSubmitted(application.submittedAt, application.createdAt)} · {application.reference}
              </span>
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1.5 text-[11px] font-black text-orange-800">WAITING</span>
          </button>
        ))}
      </div>

      {selectedId && (
        <StaffMembershipReviewModal
          applicationId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={handleChanged}
        />
      )}
    </section>
  );
}
