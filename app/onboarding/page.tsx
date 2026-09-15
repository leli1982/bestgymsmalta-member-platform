import Link from "next/link";
import { Camera, CreditCard, Dumbbell, MapPinned } from "lucide-react";

function OnboardingCard({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[1.7rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-orange-50 p-3 text-[#ff5a0a]">{icon}</div>
      <h2 className="text-xl font-black text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{text}</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main data-member-surface="onboarding-light" className="min-h-screen bg-[#f6f6f6] px-5 py-8 text-zinc-950">
      <div className="mx-auto max-w-md space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] bg-zinc-950 p-6 shadow-xl">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff5a0a]/25 blur-3xl" />
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 p-2">
              <img src="/bgm-logo.png" alt="BestGymsMalta" className="h-full w-full object-contain" />
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[.25em] text-[#ff5a0a]">Welcome</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white">Your BGM membership companion</h1>
            <p className="mt-4 text-sm font-bold leading-6 text-white/60">Your fitness passport, digital membership card, gym finder and social story creator in one simple app.</p>
          </div>
        </section>

        <div className="grid gap-4">
          <OnboardingCard title="Digital membership card" text="Keep your BGM membership status and digital membership card close at hand." icon={<CreditCard size={24} strokeWidth={3} />} />
          <OnboardingCard title="Passport" text="Visit BGM gyms across Malta and build your personal gym passport." icon={<MapPinned size={24} strokeWidth={3} />} />
          <OnboardingCard title="Fitness Goals" text="Track your goal, consistency and training progress without complicating gym operations." icon={<Dumbbell size={24} strokeWidth={3} />} />
          <OnboardingCard title="Story Creator" text="Create branded workout stories with the official BGM watermark." icon={<Camera size={24} strokeWidth={3} />} />
        </div>

        <Link href="/" className="flex w-full items-center justify-center rounded-full bg-[#ff5a0a] px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-100">Continue</Link>
      </div>
    </main>
  );
}
