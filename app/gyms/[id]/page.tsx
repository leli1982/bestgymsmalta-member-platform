import AppShell from "@/components/ui/AppShell";
import LiveGymDetailPage from "@/components/gyms/LiveGymDetailPage";
import { gyms } from "@/components/data/gyms";

export function generateStaticParams() {
  return gyms.map((gym) => ({
    id: gym.id,
  }));
}

export default async function GymDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <LiveGymDetailPage gymId={id} />
    </AppShell>
  );
}
