import { Suspense } from "react";

import MembershipEnrollmentPage from "@/components/staff/MembershipEnrollmentPage";

export default function StaffMembershipEnrollmentRoute() {
  return (
    <Suspense fallback={null}>
      <MembershipEnrollmentPage />
    </Suspense>
  );
}
