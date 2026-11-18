import StaffMemberPersonalDetailsEditor from "@/components/staff/StaffMemberPersonalDetailsEditor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  return <StaffMemberPersonalDetailsEditor memberId={memberId} />;
}
