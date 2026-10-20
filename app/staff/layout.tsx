import EmergencySupportFooter from "@/components/system/EmergencySupportFooter";
import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";
import StaffPortalReturnButton from "@/components/staff/StaffPortalReturnButton";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPortalReturnButton />
      {children}
      <EmergencySupportFooter />
      <StaffGlobalScanner />
    </>
  );
}
