import VoucherReportPrint from "@/components/staff/VoucherReportPrint";
import { todayMaltaDate } from "@/lib/maltaDate";

export default async function VoucherPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; voucher?: string; attendance?: string }>;
}) {
  const params = await searchParams;
  const today = todayMaltaDate();
  const from = params.from || `${today.slice(0, 4)}-01-01`;
  const to = params.to || today;
  const voucher = String(params.voucher || "").trim().toUpperCase();
  const requestedAttendance = String(params.attendance || "all");
  const attendance = ["all", "attended", "no-show", "not-eligible"].includes(requestedAttendance)
    ? requestedAttendance
    : "all";

  return (
    <VoucherReportPrint
      from={from}
      to={to}
      voucher={voucher}
      attendanceFilter={attendance as "all" | "attended" | "no-show" | "not-eligible"}
    />
  );
}
