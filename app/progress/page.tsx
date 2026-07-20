import ProgressVault from "@/components/progress/ProgressVault";
import StrengthTracker from "@/components/progress/StrengthTracker";
import BottomNav from "@/components/BottomNav";

export default function Page() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-md space-y-6 px-4 pb-32 pt-6 text-white">
        <ProgressVault />
        <StrengthTracker />
      </main>

      <BottomNav />
    </>
  );
}
