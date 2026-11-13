import type { Metadata } from "next";
import EmergencySupportFooter from "@/components/system/EmergencySupportFooter";
import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";
import OfflineMembershipSyncBridge from "@/components/staff/OfflineMembershipSyncBridge";
import OfflineResilienceBridge from "@/components/staff/OfflineResilienceBridge";
import BarOfflineWarmupBridge from "@/components/staff/BarOfflineWarmupBridge";
import EnrollmentOfflineWarmupBridge from "@/components/staff/EnrollmentOfflineWarmupBridge";
import StaffPortalReturnButton from "@/components/staff/StaffPortalReturnButton";
import StaffHelpCentre from "@/components/staff/StaffHelpCentre";
import AdminHelpCentre from "@/components/admin/AdminHelpCentre";

export const metadata: Metadata = {
  title: "BestGymsMalta Staff Portal",
  description: "BestGymsMalta staff management and reception portal.",
  manifest: "/staff-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BGM Staff",
  },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPortalReturnButton />
      {children}
      <OfflineMembershipSyncBridge />
      <OfflineResilienceBridge />
      <BarOfflineWarmupBridge />
      <EnrollmentOfflineWarmupBridge />
      <EmergencySupportFooter />
      <StaffHelpCentre />
      <AdminHelpCentre />
      <StaffGlobalScanner />
    </>
  );
}
