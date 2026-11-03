import AppShell from "@/components/ui/AppShell";
import LegacyMemberActivationPage from "@/components/member-auth/LegacyMemberActivationPage";

export default function Page() {
  return (
    <AppShell theme="light">
      <LegacyMemberActivationPage />
    </AppShell>
  );
}
