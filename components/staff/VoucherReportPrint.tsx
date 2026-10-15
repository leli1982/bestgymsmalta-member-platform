"use client";

import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AttendanceStatus = "attended" | "no-show" | "not-eligible";
type AttendanceFilter = "all" | AttendanceStatus;
type GymBreakdown = { gymId: string; gymName: string; visits: number };

type Voucher = {
  code: string;
  percentage: number | null;
  status: "active" | "inactive";
  statusReason: string;
  validFrom: string | null;
  validUntil: string | null;
  successfulUses: number;
  maxUses: number | null;
  membersInRange: number;
};

type Member = {
  applicationId: string;
  memberNumber?: string;
  voucherCode: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  enrollmentDate: string;
  enrollmentGymName: string;
  eligibleDays?: number;
  attendedDays?: number;
  missedDays?: number;
  attendancePercentage?: number;
  totalVisits?: number;
  lastVisitAt?: string | null;
  missedDates?: string[];
  gymBreakdown?: GymBreakdown[];
  attendanceStatus?: AttendanceStatus;
  attendanceNote?: string;
};

type ReportData = {
  from: string;
  to: string;
  generatedAt: string;
  vouchers: Voucher[];
  members: Member[];
};

function validity(voucher: Voucher) {
  if (!voucher.validFrom && !voucher.validUntil) return "No date limit";
  if (voucher.validFrom && voucher.validUntil) return `${formatEuropeanDate(voucher.validFrom)} – ${formatEuropeanDate(voucher.validUntil)}`;
  if (voucher.validFrom) return `From ${formatEuropeanDate(voucher.validFrom)}`;
  return `Until ${formatEuropeanDate(voucher.validUntil)}`;
}

function attendanceLabel(status?: AttendanceStatus) {
  if (status === "no-show") return "NO SHOW";
  if (status === "attended") return "ATTENDING";
  return "HISTORICAL / UNLINKED";
}

function filterLabel(filter: AttendanceFilter) {
  if (filter === "no-show") return "No Show only";
  if (filter === "attended") return "Attending only";
  if (filter === "not-eligible") return "Historical / Unlinked only";
  return "All members";
}

function gymBreakdown(values?: GymBreakdown[]) {
  return values?.length ? values.map((item) => `${item.gymName} ${item.visits}`).join(" / ") : "—";
}

function dateList(values?: string[]) {
  return values?.length ? values.map((value) => formatEuropeanDate(value)).join(", ") : "None";
}

export default function VoucherReportPrint({
  from,
  to,
  voucher,
  attendanceFilter,
}: {
  from: string;
  to: string;
  voucher: string;
  attendanceFilter: AttendanceFilter;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams({ from, to });
        if (voucher) params.set("voucher", voucher);
        const response = await fetch("/api/system/voucher-analytics?" + params.toString(), { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || "Could not load voucher report.");
        if (active) setData(json);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load voucher report.");
      }
    })();
    return () => { active = false; };
  }, [from, to, voucher]);

  const filteredMembers = useMemo(() => {
    return (data?.members || []).filter((member) => attendanceFilter === "all" || member.attendanceStatus === attendanceFilter);
  }, [data?.members, attendanceFilter]);

  const membersByVoucher = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const member of filteredMembers) {
      const list = map.get(member.voucherCode) || [];
      list.push(member);
      map.set(member.voucherCode, list);
    }
    return map;
  }, [filteredMembers]);

  if (error) return <main className="p-8 font-sans text-red-700">{error}</main>;
  if (!data) return <main className="p-8 font-sans">Loading voucher report…</main>;

  return (
    <main className="voucher-print min-h-screen bg-white p-6 text-zinc-950 print:p-0">
      <style jsx global>{`
        @page { size: A4 portrait; margin: 9mm; }
        @media print {
          .voucher-print-controls { display: none !important; }
          .voucher-print { padding: 0 !important; }
          .voucher-section { break-before: auto; }
          .voucher-members thead { display: table-header-group; }
          .voucher-members tr { break-inside: avoid; page-break-inside: avoid; }
          details > summary { display: none; }
          details > div { display: block !important; }
        }
      `}</style>

      <div className="voucher-print-controls mx-auto mb-6 flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <button type="button" onClick={() => window.close()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black"><ArrowLeft className="h-4 w-4" /> Close</button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white"><Printer className="h-4 w-4" /> Print / Save PDF</button>
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="border-b-2 border-zinc-950 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">BestGymsMalta</p>
          <h1 className="mt-1 text-3xl font-black">Voucher Attendance Compliance Report</h1>
          <div className="mt-3 grid gap-1 text-xs font-semibold sm:grid-cols-2">
            <p>Voucher: <strong>{voucher || "All vouchers"}</strong></p>
            <p>Attendance filter: <strong>{filterLabel(attendanceFilter)}</strong></p>
            <p>Date range: <strong>{formatEuropeanDate(data.from)} – {formatEuropeanDate(data.to)}</strong></p>
            <p>Generated: <strong>{formatEuropeanDateTime(data.generatedAt)}</strong></p>
          </div>
          <p className="mt-3 rounded-lg bg-zinc-100 p-2 text-[10px] font-semibold leading-4">
            Reporting basis: successful normal BestGymsMalta staffed member check-ins only. Attendance percentage = distinct attended calendar days ÷ eligible membership calendar days in the selected period. Multiple visits on one day count once for attendance percentage but every successful check-in counts toward Total Visits. Historical/unlinked voucher records are retained for audit and are not treated as attendance-eligible or as no-shows.
          </p>
        </header>

        <div className="mt-5 space-y-8">
          {data.vouchers.map((item) => {
            const members = membersByVoucher.get(item.code) || [];
            const eligible = members.filter((member) => (member.eligibleDays || 0) > 0);
            const noShows = eligible.filter((member) => member.attendanceStatus === "no-show");
            return (
              <section key={item.code} className="voucher-section">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-300 pb-3">
                  <div>
                    <h2 className="text-2xl font-black">{item.code}</h2>
                    <p className="mt-1 text-xs font-semibold text-zinc-600">{item.percentage === null ? "Discount not recorded" : `${item.percentage}% discount`} · {item.status.toUpperCase()} · {item.statusReason} · {validity(item)}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p><strong>{item.successfulUses}</strong> total uses</p>
                    <p><strong>{item.maxUses === null ? "N/A" : item.maxUses}</strong> maximum successful uses</p>
                    <p><strong>{eligible.length}</strong> attendance-eligible · <strong>{noShows.length}</strong> no-shows</p>
                  </div>
                </div>

                <table className="voucher-members mt-3 w-full border-collapse text-[7px] leading-3">
                  <thead>
                    <tr className="border-b border-zinc-400 text-left uppercase tracking-wide text-zinc-500">
                      <th className="py-1 pr-1">Member</th><th className="py-1 pr-1">ID</th><th className="py-1 pr-1">Gym</th><th className="py-1 pr-1">Status</th><th className="py-1 pr-1">Attendance %</th><th className="py-1 pr-1">Eligible Days</th><th className="py-1 pr-1">Attended Days</th><th className="py-1 pr-1">Missed Days</th><th className="py-1 pr-1">Total Visits</th><th className="py-1 pr-1">Last Visit</th><th className="py-1">Gym Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, index) => (
                      <tr key={member.applicationId + index} className="border-b border-zinc-200 align-top">
                        <td className="py-1.5 pr-1"><strong>{member.firstName} {member.lastName}</strong><br />{member.memberNumber || "—"}<br />Enrolled {formatEuropeanDate(member.enrollmentDate)}</td>
                        <td className="py-1.5 pr-1">{member.idNumber || "—"}</td>
                        <td className="py-1.5 pr-1">{member.enrollmentGymName}</td>
                        <td className="py-1.5 pr-1 font-bold">{attendanceLabel(member.attendanceStatus)}</td>
                        <td className="py-1.5 pr-1 font-bold">{member.attendanceStatus === "not-eligible" ? "—" : `${member.attendancePercentage ?? 0}%`}</td>
                        <td className="py-1.5 pr-1">{member.eligibleDays ?? 0}</td>
                        <td className="py-1.5 pr-1">{member.attendedDays ?? 0}</td>
                        <td className="py-1.5 pr-1 font-bold">{member.missedDays ?? 0}</td>
                        <td className="py-1.5 pr-1 font-bold">{member.totalVisits ?? 0}</td>
                        <td className="py-1.5 pr-1">{member.lastVisitAt ? formatEuropeanDateTime(member.lastVisitAt) : "—"}</td>
                        <td className="py-1.5">{gymBreakdown(member.gymBreakdown)}</td>
                      </tr>
                    ))}
                    {members.length === 0 ? <tr><td colSpan={11} className="py-4 text-center text-zinc-500">No members match this voucher and attendance filter.</td></tr> : null}
                  </tbody>
                </table>

                {members.some((member) => member.attendanceStatus === "no-show" || (member.missedDates?.length || 0) > 0) ? (
                  <div className="mt-3 space-y-1 text-[8px] leading-3">
                    <p className="font-black uppercase tracking-wide">Missed dates audit</p>
                    {members.filter((member) => member.attendanceStatus !== "not-eligible" && (member.missedDates?.length || 0) > 0).map((member, index) => (
                      <p key={member.applicationId + "missed" + index}><strong>{member.firstName} {member.lastName} ({member.memberNumber || member.idNumber || "member"}) — Missed dates:</strong> {dateList(member.missedDates)}</p>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
