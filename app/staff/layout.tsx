import EmergencySupportFooter from "@/components/system/EmergencySupportFooter";
import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";
import OfflineMembershipSyncBridge from "@/components/staff/OfflineMembershipSyncBridge";
import StaffPortalReturnButton from "@/components/staff/StaffPortalReturnButton";
import StaffHelpCentre from "@/components/staff/StaffHelpCentre";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPortalReturnButton />
      {children}
      <OfflineMembershipSyncBridge />
      <EmergencySupportFooter />
      <StaffHelpCentre />
      <StaffGlobalScanner />
    </>
  );
}
