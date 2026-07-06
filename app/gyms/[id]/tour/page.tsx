import AppShell from "@/components/ui/AppShell";
import GymTourPage from "@/components/gyms/GymTourPage";
import { gyms } from "@/components/data/gyms";

export function generateStaticParams() {
  return gyms.map((gym) => ({
    id: gym.id,
  }));
}

export default async function GymTourRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <GymTourPage gymId={id} />
    </AppShell>
  );
}
