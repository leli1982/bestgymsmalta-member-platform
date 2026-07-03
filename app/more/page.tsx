import BottomNav from "@/components/BottomNav";
import MorePage from "@/components/more/MorePage";

export default function Page() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-md px-4 pb-32 pt-6 text-white">
        <MorePage />
      </main>

      <BottomNav />
    </>
  );
}
