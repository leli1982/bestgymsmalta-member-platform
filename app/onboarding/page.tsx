import { Gift, MapPinned, Share2, Trophy } from "lucide-react";
import Button from "@/components/ui/Button";
import FeatureCard from "@/components/ui/FeatureCard";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-black px-5 pb-10 pt-8 text-white">
      <div className="mx-auto max-w-md">
        <img
          src="/logos/bgm-horizontal.png"
          alt="BestGymsMalta"
          className="w-44"
        />

        <section className="relative mt-8 min-h-[360px] overflow-hidden rounded-[2rem] border border-orange-500/60 bg-zinc-950 p-6 shadow-[0_0_35px_rgba(249,115,22,0.25)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(249,115,22,0.55),transparent_40%)]" />
          <img
            src="/images/male-athlete.png"
            alt="Athlete"
            className="absolute bottom-0 right-0 h-full w-[60%] object-cover object-bottom"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />

          <div className="relative z-10 max-w-[62%]">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-orange-500">
              Introducing
            </p>
            <h1 className="mt-3 text-6xl font-black uppercase leading-none">
              BestGyms
              <br />
              GO
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              Your fitness passport, reward wallet and social story creator.
            </p>
          </div>
        </section>

        <div className="mt-5 grid gap-4">
          <FeatureCard
            icon={<Trophy size={24} />}
            title="Earn Rewards"
            text="Check in, complete challenges and collect points every time you train."
          />
          <FeatureCard
            icon={<Share2 size={24} />}
            title="Share Fast"
            text="Create branded workout stories with your gym, streak and BestGyms GO style."
          />
          <FeatureCard
            icon={<MapPinned size={24} />}
            title="Unlock Gyms"
            text="Visit all 10 BestGymsMalta locations and complete your gym passport."
          />
          <FeatureCard
            icon={<Gift size={24} />}
            title="Redeem Perks"
            text="Use your points for rewards, offers, challenges and exclusive benefits."
          />
        </div>

        <div className="mt-6 grid gap-3">
          <Button href="/login">Get Started</Button>
          <Button href="/" variant="secondary">
            Preview App
          </Button>
        </div>
      </div>
    </main>
  );
}