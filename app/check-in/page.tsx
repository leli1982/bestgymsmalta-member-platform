import { activeGyms } from "@/components/data/gyms";
import {
  Camera,
  CheckCircle2,
  MapPin,
  QrCode,
  Share2,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";

export default function CheckInPage() {
  return (
    <AppShell useTopBar={false} title="Check In" eyebrow="BestGymsMalta">
      <GlassPanel variant="hero" className="orange-halo">
        <p className="luxury-label">Scan QR</p>

        <h1 className="mt-4 text-6xl font-black uppercase italic leading-[0.85] tracking-tighter">
          Check
          <br />
          In
        </h1>

        <p className="mt-4 max-w-[260px] text-sm leading-relaxed text-zinc-400">
          Scan your gym QR code to confirm your visit, earn points and keep your
          streak alive.
        </p>

        <div className="mt-8 flex aspect-square items-center justify-center rounded-[32px] border border-primary/30 bg-black/50 shadow-glow">
          <div className="icon-token h-28 w-28 rounded-[32px]">
            <QrCode size={64} />
          </div>
        </div>

        <div className="mt-6">
          <Button className="w-full text-lg">
            <QrCode size={22} />
            Scan Gym QR
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-5">
        <p className="luxury-label">Choose Gym</p>

        <div className="mt-4 grid gap-3">
          {activeGyms.map((gym) => (
            <button
              key={gym.id}
              className="flex items-center justify-between rounded-[24px] bg-black/45 p-4 text-left transition active:scale-95"
            >
              <div className="flex items-center gap-3">
                <div className="icon-token h-11 w-11 rounded-2xl">
                  <MapPin size={20} />
                </div>
                <p className="font-black">{gym.name}</p>
              </div>

              {gym.id === "bgm-pembroke" && (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-black uppercase text-black">
                  Selected
                </span>
              )}
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="mt-5 bgm-pattern bgm-soft-glow">
        <div className="flex items-center gap-4">
          <div className="icon-token h-16 w-16 rounded-full">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <p className="luxury-label">Success Preview</p>
            <h2 className="mt-1 text-3xl font-black uppercase italic">
              Welcome Back
            </h2>
            <p className="mt-1 text-sm text-muted">Pembroke Fitness</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <MiniStat label="Points" value="+20" />
          <MiniStat label="Streak" value="12" />
          <MiniStat label="Gym" value="6/10" />
        </div>
      </GlassPanel>

      <GlassPanel className="mt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="luxury-label">Share Workout</p>
            <h2 className="mt-2 text-3xl font-black uppercase italic leading-none">
              Create
              <br />
              Story
            </h2>
            <p className="mt-3 text-sm text-muted">
              Generate a branded BestGymsMalta story after your check-in.
            </p>
          </div>

          <div className="icon-token h-16 w-16 rounded-[24px]">
            <Camera size={30} />
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <Button>
            <Sparkles size={20} />
            Generate Story
          </Button>

          <Button variant="secondary">
            <Share2 size={20} />
            Share Later
          </Button>
        </div>
      </GlassPanel>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-black/50 p-4 text-center">
      <p className="text-2xl font-black text-primary">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase text-muted">
        {label}
      </p>
    </div>
  );
}