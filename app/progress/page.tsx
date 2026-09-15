import ProgressVault from "@/components/progress/ProgressVault";
import StrengthTracker from "@/components/progress/StrengthTracker";
import AppShell from "@/components/ui/AppShell";

export default function Page() {
  return (
    <AppShell theme="light">
      <div className="space-y-6">
        <ProgressVault />
        <StrengthTracker />
      </div>
    </AppShell>
  );
}
