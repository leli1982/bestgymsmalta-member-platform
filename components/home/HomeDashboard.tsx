import Image from "next/image";
import {
  Camera,
  CreditCard,
  Dumbbell,
  MapPinned,
  QrCode,
  Sparkles,
} from "lucide-react";
import QuickActionCard from "@/components/ui/QuickActionCard";
import DashboardStats from "@/components/home/DashboardStats";
import PassportPreview from "@/components/home/PassportPreview";
import StoryPreview from "@/components/home/StoryPreview";

export default function HomeDashboard() {
  return (
    <div className="space-y-6">
      <DashboardStats />

      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[.25em] text-orange-500">
          Quick Actions
        </p>

        <div className="grid grid-cols-2 gap-3">
          <QuickActionCard
            href="/card"
            icon={<CreditCard size={24} />}
            title="Member Card"
            subtitle="NFC-ready"
          />

          <QuickActionCard
            href="/check-in"
            icon={<QrCode size={24} />}
            title="Check-In"
            subtitle="Confirm visit"
          />

          <QuickActionCard
            href="/passport"
            icon={<MapPinned size={24} />}
            title="Passport"
            subtitle="Visited gyms"
          />

          <QuickActionCard
            href="/gyms"
            icon={<Dumbbell size={24} />}
            title="Gym Finder"
            subtitle="Directions"
          />

          <QuickActionCard
            href="/trainer"
            icon={<Sparkles size={24} />}
            title="Trainer"
            subtitle="Workout help"
          />

          <QuickActionCard
            href="/story"
            icon={<Camera size={24} />}
            title="Story"
            subtitle="Share"
          />
        </div>
      </div>

      <PassportPreview />
      <StoryPreview />
    </div>
  );
}
