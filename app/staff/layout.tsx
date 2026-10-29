import EmergencySupportFooter from "@/components/system/EmergencySupportFooter";
import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";
import OfflineMembershipSyncBridge from "@/components/staff/OfflineMembershipSyncBridge";
import OfflineResilienceBridge from "@/components/staff/OfflineResilienceBridge";
import BarOfflineWarmupBridge from "@/components/staff/BarOfflineWarmupBridge";
import StaffPortalReturnButton from "@/components/staff/StaffPortalReturnButton";
import StaffHelpCentre from "@/components/staff/StaffHelpCentre";
import AdminHelpCentre from "@/components/admin/AdminHelpCentre";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPortalReturnButton />
      {children}
      <OfflineMembershipSyncBridge />
      <OfflineResilienceBridge />
      <BarOfflineWarmupBridge />
      <EmergencySupportFooter />
      <StaffHelpCentre />
      <AdminHelpCentre />
      <StaffGlobalScanner />
    </>
  );
}
