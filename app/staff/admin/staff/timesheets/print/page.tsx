import { Suspense } from "react";
import StaffTimesheetPrint from "@/components/staff/StaffTimesheetPrint";

export default function StaffTimesheetPrintPage() {
  return <Suspense fallback={<main className="p-8">Loading BestGymsMalta timesheet…</main>}><StaffTimesheetPrint/></Suspense>;
}
