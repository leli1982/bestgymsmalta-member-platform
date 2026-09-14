import AppShell from "@/components/ui/AppShell";
import MemberCard from "@/components/member/MemberCard";

export default function CardPage() {
  return (
    <AppShell theme="light">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#c2410c]">
            Membership Card
          </p>
          <h1 className="mt-2 text-3xl font-black text-zinc-950">
            Your BGM access card
          </h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            Your virtual card shows the same barcode as your currently issued physical BGM card.

          </p>
        </div>

        <MemberCard />
      </div>
    </AppShell>
  );
}
