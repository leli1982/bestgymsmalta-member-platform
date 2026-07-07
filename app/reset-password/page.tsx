import AppShell from "@/components/ui/AppShell";
import ResetPasswordPage from "@/components/member-auth/ResetPasswordPage";

export default async function ResetPasswordRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <ResetPasswordPage token={String(params.token || "")} />
    </AppShell>
  );
}
