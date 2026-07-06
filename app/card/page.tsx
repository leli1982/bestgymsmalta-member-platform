import AppShell from "@/components/ui/AppShell";
import MemberCard from "@/components/member/MemberCard";

export default function CardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#fcb415]">
            Membership Card
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Your BGM access card
          </h1>
          <p className="mt-2 text-sm font-bold text-white/50">
            Show your digital card when needed. NFC-ready membership access is
            prepared for future rollout.
          </p>
        </div>

        <MemberCard />
      </div>
    </AppShell>
  );
}