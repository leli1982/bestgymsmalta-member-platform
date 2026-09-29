import StaffApplicationPrint from "@/components/staff/StaffApplicationPrint";

export default async function StaffApplicationPrintPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return <StaffApplicationPrint applicationId={applicationId} />;
}
