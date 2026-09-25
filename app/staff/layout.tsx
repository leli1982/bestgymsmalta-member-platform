import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";
import StaffPortalReturnButton from "@/components/staff/StaffPortalReturnButton";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPortalReturnButton />
      {children}
      <StaffGlobalScanner />
    </>
  );
}
