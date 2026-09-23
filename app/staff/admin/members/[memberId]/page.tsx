import SuperAdminMemberEditor from "@/components/staff/SuperAdminMemberEditor";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  return <SuperAdminMemberEditor memberId={memberId} />;
}
