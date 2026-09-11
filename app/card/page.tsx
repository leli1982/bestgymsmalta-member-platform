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
            Your virtual card shows the same barcode as your currently issued physical BGM card.
            If reception replaces the physical card, reopening this screen refreshes the same barcode automatically.
          </p>
        </div>

        <MemberCard />
      </div>
    </AppShell>
  );
}
