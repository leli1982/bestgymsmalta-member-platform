import BarcodeReceptionPage from "@/components/staff/BarcodeReceptionPage";

export const dynamic = "force-dynamic";

export default function StaffReceptionPage() {
  return (
    <>
      <a
        href="/staff/reception/issue-card"
        className="fixed bottom-4 right-4 z-50 rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-xl"
      >
        Issue New Card
      </a>
      <BarcodeReceptionPage />
    </>
  );
}
