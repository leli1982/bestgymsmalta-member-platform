import { Gift, MapPinned, Share2 } from "lucide-react";
import ChallengeCard from "@/components/ui/ChallengeCard";
import QuickActionCard from "@/components/ui/QuickActionCard";
import RewardPreview from "@/components/ui/RewardPreview";

export default function HomeDashboard() {
  return (
    <>
      <div className="mt-5">
        <ChallengeCard
          title="Complete a Workout"
          description="Check in today and keep your streak alive."
          points="+20 points"
        />
      </div>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <QuickActionCard
          href="/check-in"
          icon={<Share2 size={22} />}
          title="Story"
          subtitle="Share"
        />

        <QuickActionCard
          href="/passport"
          icon={<MapPinned size={22} />}
          title="Passport"
          subtitle="Unlock"
        />

        <QuickActionCard
          href="/rewards"
          icon={<Gift size={22} />}
          title="Rewards"
          subtitle="Redeem"
        />
      </section>

      <div className="mt-5">
        <RewardPreview title="Free Protein Shake" current={1450} target={2000} />
      </div>
    </>
  );
}