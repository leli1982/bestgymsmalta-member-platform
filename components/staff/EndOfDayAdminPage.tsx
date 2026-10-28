"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { formatBarEuro } from "@/lib/barSalesCore";

type Gym = { id: string; name: string; status?: string };
type ReportRow = {
  id: string;
  gymId: string;
  gymName: string;
  staffName: string;
  businessDate: string;
  submittedAt: string;
  dailyTotalCents: number;
};
type MoneySplit = { cashCents: number; cardCents: number; otherCents: number };
type ReportDetail = ReportRow & {
  memberships: MoneySplit;
  renewals: MoneySplit;
  voucherReimbursementCents: number;
  barSalesCents: number;
  grossCents: number;
  expensesTotalCents: number;
  expenses: Array<{ id: string; description: string; amountCents: number }>;
  barItems: Array<{ id: string; itemName: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>;
  vouchers: Array<{ id: string; voucherCode: string; quantity: number; reimbursementTotalCents: number }>;
};

function displayDate(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function displayTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function SplitRows({ title, values }: { title: string; values: MoneySplit }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><span className="block text-xs font-bold text-zinc-500">Cash</span><strong>{formatBarEuro(values.cashCents)}</strong></div>
        <div><span className="block text-xs font-bold text-zinc-500">Card</span><strong>{formatBarEuro(values.cardCents)}</strong></div>
        <div><span className="block text-xs font-bold text-zinc-500">Other</span><strong>{formatBarEuro(values.otherCents)}</strong></div>
      </div>
    </div>
  );
}

export default function EndOfDayAdminPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [openId, setOpenId] = useState("");
  const [details, setDetails] = useState<Record<string, ReportDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async (filterGymId = "") => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ admin: "1" });
      if (filterGymId) query.set("gymId", filterGymId);
      const response = await fetch(`/api/system/end-of-day?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load End of Day reports.");
      setReports(payload.reports || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load End of Day reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const gymsResponse = await fetch("/api/gyms", { cache: "no-store" });
        const payload = gymsResponse.ok ? await gymsResponse.json() : { gyms: [] };
        if (active) setGyms(payload.gyms || []);
      } catch {
        // Report rows still carry the gym name even if the filter list fails.
      }
      if (active) await loadReports("");
    })();
    return () => { active = false; };
  }, [loadReports]);

  async function toggleReport(id: string) {
    if (openId === id) {
      setOpenId("");
      return;
    }
    setOpenId(id);
    if (details[id]) return;
    try {
      const response = await fetch(`/api/system/end-of-day?reportId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load this report.");
      setDetails((current) => ({ ...current, [id]: payload.report }));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Could not load this report.");
    }
  }

  return (
    <main className="bgm-admin-light min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <a href="/staff/admin" className="inline-flex items-center gap-2 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4" /> Super Admin</a>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-widest text-[#ff5a0a]">BestGymsMalta · Operations</p><h1 className="text-3xl font-black">End of Day</h1><p className="mt-1 text-sm text-zinc-600">Submitted daily reports from all gyms.</p></div>
            <button type="button" onClick={() => void loadReports(gymId)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black"><RefreshCcw className="h-4 w-4" /> Refresh</button>
          </div>
          <label className="mt-5 block max-w-md text-sm font-black">Filter by gym
            <select aria-label="End of Day gym filter" value={gymId} onChange={(event) => { const next = event.target.value; setGymId(next); setOpenId(""); void loadReports(next); }} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950">
              <option value="">All gyms</option>
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
            </select>
          </label>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {loading ? <div className="rounded-3xl bg-white p-6">Loading reports…</div> : reports.length === 0 ? <div className="rounded-3xl bg-white p-6 text-sm font-bold text-zinc-500">No End of Day reports found.</div> : (
          <div className="space-y-3">
            {reports.map((report) => {
              const detail = details[report.id];
              const open = openId === report.id;
              return (
                <section key={report.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
                  <button type="button" onClick={() => void toggleReport(report.id)} className="grid w-full gap-3 p-4 text-left sm:grid-cols-[1.5fr_1.1fr_120px_90px_140px_auto] sm:items-center">
                    <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-400">Gym</span><strong>{report.gymName}</strong></div>
                    <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-400">Staff</span><strong>{report.staffName}</strong></div>
                    <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-400">Date</span><strong>{displayDate(report.businessDate)}</strong></div>
                    <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-400">Time</span><strong>{displayTime(report.submittedAt)}</strong></div>
                    <div><span className="block text-xs font-black uppercase tracking-wide text-zinc-400">End of Day Total</span><strong className="text-lg">{formatBarEuro(report.dailyTotalCents)}</strong></div>
                    {open ? <ChevronUp className="h-5 w-5 text-orange-700" /> : <ChevronDown className="h-5 w-5 text-orange-700" />}
                  </button>

                  {open && (
                    <div className="border-t border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
                      {!detail ? <p className="text-sm font-bold text-zinc-500">Loading details…</p> : (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <SplitRows title="New Memberships" values={detail.memberships} />
                          <SplitRows title="Renewals" values={detail.renewals} />
                          <div className="rounded-2xl bg-white p-4"><h3 className="font-black">Voucher reimbursements</h3><div className="mt-3 space-y-2">{detail.vouchers.length ? detail.vouchers.map((voucher) => <div key={voucher.id} className="flex justify-between gap-3 text-sm"><span>{voucher.voucherCode} × {voucher.quantity}</span><strong>{formatBarEuro(voucher.reimbursementTotalCents)}</strong></div>) : <p className="text-sm text-zinc-500">None.</p>}</div><p className="mt-3 border-t border-zinc-100 pt-3 text-right font-black">{formatBarEuro(detail.voucherReimbursementCents)}</p></div>
                          <div className="rounded-2xl bg-white p-4"><h3 className="font-black">Bar</h3><div className="mt-3 space-y-2">{detail.barItems.length ? detail.barItems.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.itemName} × {item.quantity}</span><strong>{formatBarEuro(item.lineTotalCents)}</strong></div>) : <p className="text-sm text-zinc-500">No Bar sales.</p>}</div><p className="mt-3 border-t border-zinc-100 pt-3 text-right font-black">{formatBarEuro(detail.barSalesCents)}</p></div>
                          <div className="rounded-2xl bg-white p-4"><h3 className="font-black">Expenses</h3><div className="mt-3 space-y-2">{detail.expenses.length ? detail.expenses.map((expense) => <div key={expense.id} className="flex justify-between gap-3 text-sm"><span>{expense.description}</span><strong>{formatBarEuro(expense.amountCents)}</strong></div>) : <p className="text-sm text-zinc-500">No expenses.</p>}</div><p className="mt-3 border-t border-zinc-100 pt-3 text-right font-black">{formatBarEuro(detail.expensesTotalCents)}</p></div>
                          <div className="rounded-2xl bg-zinc-950 p-4 text-white"><div className="flex justify-between"><span>Gross total</span><strong>{formatBarEuro(detail.grossCents)}</strong></div><div className="mt-2 flex justify-between"><span>Expenses</span><strong>- {formatBarEuro(detail.expensesTotalCents)}</strong></div><div className="mt-4 flex justify-between border-t border-zinc-700 pt-4 text-xl font-black"><span>End of Day Total</span><span className="text-orange-400">{formatBarEuro(detail.dailyTotalCents)}</span></div></div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
