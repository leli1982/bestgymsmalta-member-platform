import MembershipSettingsAdmin from "@/components/staff/MembershipSettingsAdmin";
import SingleGymPricingAdmin from "@/components/staff/SingleGymPricingAdmin";
import VoucherReimbursementAdmin from "@/components/staff/VoucherReimbursementAdmin";

export default function MembershipSettingsPage() {
  return (
    <>
      <MembershipSettingsAdmin />
      <SingleGymPricingAdmin />
      <VoucherReimbursementAdmin />
    </>
  );
}
