import EmergencySupportFooter from "@/components/system/EmergencySupportFooter";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <EmergencySupportFooter />
    </>
  );
}
