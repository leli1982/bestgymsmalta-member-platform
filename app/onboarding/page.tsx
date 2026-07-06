import Link from "next/link";
import { Camera, CreditCard, Dumbbell, MapPinned } from "lucide-react";

function OnboardingCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 inline-flex rounded-2xl bg-[#fcb415]/10 p-3 text-[#fcb415]">
        {icon}
      </div>
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#fcb415]">
            Welcome
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight">
            Your BGM membership companion
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/55">
            Your fitness passport, digital membership card, gym finder and
            social story creator in one simple app.
          </p>
        </div>

        <div className="grid gap-4">
          <OnboardingCard
            title="Membership Card"
            text="Keep your BGM membership status and NFC-ready card close at hand."
            icon={<CreditCard size={24} strokeWidth={3} />}
          />

          <OnboardingCard
            title="Passport"
            text="Visit BGM gyms across Malta and build your personal gym passport."
            icon={<MapPinned size={24} strokeWidth={3} />}
          />

          <OnboardingCard
            title="Fitness Goals"
            text="Track your goal, consistency and training progress without complicating gym operations."
            icon={<Dumbbell size={24} strokeWidth={3} />}
          />

          <OnboardingCard
            title="Story Creator"
            text="Create branded workout stories with the official BGM watermark."
            icon={<Camera size={24} strokeWidth={3} />}
          />
        </div>

        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-full bg-[#fcb415] px-5 py-4 text-sm font-black text-black"
        >
          Continue
        </Link>
      </div>
    </main>
  );
}
