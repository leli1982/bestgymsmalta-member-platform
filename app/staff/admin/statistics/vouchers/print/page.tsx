import VoucherReportPrint from "@/components/staff/VoucherReportPrint";
import { todayMaltaDate } from "@/lib/maltaDate";

export default async function VoucherPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; voucher?: string }>;
}) {
  const params = await searchParams;
  const today = todayMaltaDate();
  const from = params.from || `${today.slice(0, 4)}-01-01`;
  const to = params.to || today;
  const voucher = String(params.voucher || "").trim().toUpperCase();

  return <VoucherReportPrint from={from} to={to} voucher={voucher} />;
}
