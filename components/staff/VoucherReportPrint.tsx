"use client";

import { formatEuropeanDate, formatEuropeanDateTime } from "@/lib/europeanDate";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Voucher = {
  code: string;
  status: "active" | "inactive";
  statusReason: string;
  validFrom: string | null;
  validUntil: string | null;
  successfulUses: number;
  membersInRange: number;
};

type Member = {
  applicationId: string;
  voucherCode: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  enrollmentDate: string;
  enrollmentGymName: string;
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
  if (voucher.validFrom && voucher.validUntil) {
    return `${formatEuropeanDate(voucher.validFrom)} – ${formatEuropeanDate(voucher.validUntil)}`;
  }
  if (voucher.validFrom) return `From ${formatEuropeanDate(voucher.validFrom)}`;
  return `Until ${formatEuropeanDate(voucher.validUntil)}`;
}

export default function VoucherReportPrint({
  from,
  to,
  voucher,
}: {
  from: string;
  to: string;
  voucher: string;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams({ from, to });
        if (voucher) params.set("voucher", voucher);
        const response = await fetch(
          "/api/system/voucher-analytics?" + params.toString(),
          { cache: "no-store" }
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || "Could not load voucher report.");
        if (active) setData(json);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load voucher report.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [from, to, voucher]);

  const membersByVoucher = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const member of data?.members || []) {
      const list = map.get(member.voucherCode) || [];
      list.push(member);
      map.set(member.voucherCode, list);
    }
    return map;
  }, [data?.members]);

  if (error) {
    return <main className="p-8 font-sans text-red-700">{error}</main>;
  }

  if (!data) {
    return <main className="p-8 font-sans">Loading voucher report…</main>;
  }

  return (
    <main className="voucher-print min-h-screen bg-white p-6 text-zinc-950 print:p-0">
      <style jsx global>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print {
          .voucher-print-controls { display: none !important; }
          .voucher-print { padding: 0 !important; }
          .voucher-section { break-inside: avoid; page-break-inside: avoid; }
          .voucher-members thead { display: table-header-group; }
          .voucher-members tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="voucher-print-controls mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <button type="button" onClick={() => window.close()} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-black">
          <ArrowLeft className="h-4 w-4" /> Close
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div className="mx-auto max-w-5xl">
        <header className="border-b-2 border-zinc-950 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">BestGymsMalta</p>
          <h1 className="mt-1 text-3xl font-black">Corporate Voucher Report</h1>
          <div className="mt-3 grid gap-1 text-sm font-semibold sm:grid-cols-2">
            <p>Voucher: <strong>{voucher || "All vouchers"}</strong></p>
            <p>Date range: <strong>{formatEuropeanDate(data.from)} – {formatEuropeanDate(data.to)}</strong></p>
            <p className="sm:col-span-2">Generated: {formatEuropeanDateTime(data.generatedAt)}</p>
          </div>
        </header>

        <div className="mt-6 space-y-8">
          {data.vouchers.map((item) => {
            const members = membersByVoucher.get(item.code) || [];
            return (
              <section key={item.code} className="voucher-section">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-300 pb-3">
                  <div>
                    <h2 className="text-2xl font-black">{item.code}</h2>
                    <p className="mt-1 text-sm font-semibold text-zinc-600">
                      {item.status.toUpperCase()} · {item.statusReason} · {validity(item)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p><strong>{item.successfulUses}</strong> total uses</p>
                    <p><strong>{members.length}</strong> members in selected range</p>
                  </div>
                </div>

                <table className="voucher-members mt-3 w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-zinc-400 text-left uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-2">Name</th>
                      <th className="py-2 pr-2">Surname</th>
                      <th className="py-2 pr-2">ID Number</th>
                      <th className="py-2 pr-2">Enrollment Date</th>
                      <th className="py-2 pr-2">Gym</th>
                      <th className="py-2">Voucher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, index) => (
                      <tr key={member.applicationId + index} className="border-b border-zinc-200">
                        <td className="py-2 pr-2">{member.firstName || "—"}</td>
                        <td className="py-2 pr-2 font-bold">{member.lastName || "—"}</td>
                        <td className="py-2 pr-2">{member.idNumber || "—"}</td>
                        <td className="py-2 pr-2">{formatEuropeanDate(member.enrollmentDate)}</td>
                        <td className="py-2 pr-2">{member.enrollmentGymName}</td>
                        <td className="py-2 font-bold">{member.voucherCode}</td>
                      </tr>
                    ))}
                    {members.length === 0 ? (
                      <tr><td colSpan={6} className="py-4 text-center text-zinc-500">No members used this voucher in the selected date range.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
