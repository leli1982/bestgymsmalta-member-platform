import AppShell from "@/components/ui/AppShell";
import GlassPanel from "@/components/ui/GlassPanel";
import MemberCard from "@/components/member/MemberCard";

export default function MemberShowcasePage() {
  return (
    <AppShell useTopBar={false} title="Member" eyebrow="BestGymsMalta">
      <GlassPanel>
        <p className="luxury-label">Flagship Component</p>
        <h1 className="mt-3 text-5xl font-black uppercase italic leading-none">
          Member
          <br />
          Card
        </h1>
        <p className="mt-4 text-sm text-muted">
          Tap the card to flip between membership status and NFC card details.
        </p>
      </GlassPanel>

      <div className="mt-5">
        <MemberCard />
      </div>
    </AppShell>
  );
}