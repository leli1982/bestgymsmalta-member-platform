import StaffGlobalScanner from "@/components/staff/StaffGlobalScanner";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StaffGlobalScanner />
    </>
  );
}
