"use client";

import { formatEuropeanDate } from "@/lib/europeanDate";
import { CalendarClock } from "lucide-react";

export default function StaffScanRenewalBanner({
  daysRemaining,
  expiryDate,
}: {
  daysRemaining: number;
  expiryDate: string;
}) {
  const timing = daysRemaining === 0
    ? "EXPIRES TODAY"
    : daysRemaining === 1
      ? "EXPIRES TOMORROW"
      : `EXPIRES IN ${daysRemaining} DAYS`;
  return (
    <section role="status" data-testid="staff-renewal-due-banner"
      className="mx-auto mt-4 max-w-4xl rounded-2xl border-4 border-orange-700 bg-orange-50 px-4 py-4 text-left text-orange-950 shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-9 w-9 shrink-0 text-orange-700" aria-hidden="true" />
        <div>
          <p className="text-xl font-black tracking-wide sm:text-2xl">RENEWAL DUE SOON</p>
          <p className="text-lg font-black">{timing} · {formatEuropeanDate(expiryDate)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold sm:text-base">
        ACCESS GRANTED. Please offer this member a renewal while they are here.
      </p>
    </section>
  );
}
