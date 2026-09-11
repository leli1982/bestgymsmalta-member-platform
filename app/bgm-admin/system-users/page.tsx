import SystemUsersAdmin from "@/components/admin/SystemUsersAdmin";

export const dynamic = "force-dynamic";

export default function SystemUsersPage() {
  return (
    <>
      <a
        href="/bgm-admin/notifications"
        className="fixed bottom-5 right-5 z-50 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg"
      >
        Notification Settings
      </a>
      <SystemUsersAdmin />
    </>
  );
}
