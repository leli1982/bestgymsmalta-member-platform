import ProgressVault from "@/components/progress/ProgressVault";
import BottomNav from "@/components/BottomNav";

export default function Page() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-md px-4 pb-32 pt-6 text-white">
        <ProgressVault />
      </main>

      <BottomNav />
    </>
  );
}
