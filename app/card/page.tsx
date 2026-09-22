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
            Your BGM membership number identifies your account. Your digital barcode uses your current physical card number; staff can also find you using your BGM number.

          </p>
        </div>

        <MemberCard />
      </div>
    </AppShell>
  );
}
