import AppShell from "@/components/ui/AppShell";
import CheckInScreen from "@/components/checkins/CheckInPage";

type CheckInGymRoutePageProps = {
  params: Promise<{
    gymId: string;
  }>;
};

export default async function CheckInGymRoutePage({
  params,
}: CheckInGymRoutePageProps) {
  const { gymId } = await params;

  return (
    <AppShell>
      <CheckInScreen gymId={gymId} />
    </AppShell>
  );
}
