import AppShell from "@/components/ui/AppShell";
import CheckInScreen from "@/components/checkins/CheckInPage";
import ScanGymQrPage from "@/components/checkins/ScanGymQrPage";

type CheckInRoutePageProps = {
  searchParams: Promise<{
    gymId?: string;
    gym?: string;
    id?: string;
  }>;
};

export default async function CheckInRoutePage({
  searchParams,
}: CheckInRoutePageProps) {
  const params = await searchParams;
  const gymId = params.gymId || params.gym || params.id || "";

  return (
    <AppShell>
      {gymId ? <CheckInScreen gymId={gymId} /> : <ScanGymQrPage />}
    </AppShell>
  );
}
