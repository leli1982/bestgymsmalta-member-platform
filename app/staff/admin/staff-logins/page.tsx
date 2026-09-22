import SystemUsersAdmin from "@/components/admin/SystemUsersAdmin";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ gymId?: string }> }) {
  const params = await searchParams;
  return <SystemUsersAdmin scope="gym_staff" initialGymId={params.gymId || ""}/>;
}
