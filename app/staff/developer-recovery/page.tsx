import DeveloperRecoveryForm from "@/components/staff/DeveloperRecoveryForm";

export const dynamic = "force-dynamic";

export default async function DeveloperRecoveryPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <>
    <meta name="referrer" content="no-referrer" />
    <DeveloperRecoveryForm token={typeof token === "string" ? token : ""} />
  </>;
}
