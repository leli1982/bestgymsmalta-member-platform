import AppShell from "@/components/ui/AppShell";
import { Camera, MapPinned, QrCode, ShieldCheck } from "lucide-react";

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-500">
            Check In
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Confirm your gym visit
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Scan your gym QR code to confirm your visit, update your passport
            and keep your training history active.
          </p>
        </div>

        <div className="rounded-[2rem] border border-orange-500/25 bg-orange-500/10 p-6 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border border-orange-500/40 bg-black/40 text-orange-500">
            <QrCode size={56} strokeWidth={3} />
          </div>

          <h2 className="mt-6 text-2xl font-black text-white">
            Ready to scan
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            This will later connect to the real gym QR/NFC check-in system.
          </p>

          <button className="mt-6 w-full rounded-full bg-orange-500 px-5 py-4 text-sm font-black text-black">
            Start Check-In
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Status" value="Active" />
          <MiniStat label="Passport" value="6/10" />
          <MiniStat label="Streak" value="12" />
        </div>

        <div className="grid gap-3">
          <a
            href="/passport"
            className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <MapPinned className="text-orange-500" size={24} strokeWidth={3} />
            <div>
              <p className="font-black text-white">Open Passport</p>
              <p className="text-sm text-white/45">
                View your visited BGM gyms.
              </p>
            </div>
          </a>

          <a
            href="/story"
            className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <Camera className="text-orange-500" size={24} strokeWidth={3} />
            <div>
              <p className="font-black text-white">Create Story</p>
              <p className="text-sm text-white/45">
                Add the official BGM watermark and share.
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheck className="text-orange-500" size={24} strokeWidth={3} />
            <div>
              <p className="font-black text-white">NFC-ready</p>
              <p className="text-sm text-white/45">
                Membership card prepared for future NFC rollout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
