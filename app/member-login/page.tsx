import AppShell from "@/components/ui/AppShell";
import MemberLoginPage from "@/components/member-auth/MemberLoginPage";

export default function Page() {
  return (
    <AppShell theme="light">
      <div className="space-y-4">
        <MemberLoginPage />
        <a
          href="/legacy-activate"
          className="block rounded-[1.5rem] border border-orange-200 bg-orange-50 p-4 text-center text-sm font-black text-[#ff5a0a]"
        >
          Existing member? I only know my old membership number
        </a>
      </div>
    </AppShell>
  );
}
