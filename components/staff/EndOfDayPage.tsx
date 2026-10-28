"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { formatBarEuro, parseEuroCents } from "@/lib/barSalesCore";

type MoneySplit = { cashCents: number; cardCents: number; otherCents: number };
type Voucher = { voucherCode: string; quantity: number; reimbursementTotalCents: number };
type BarItem = { itemName: string; quantity: number; unitPriceCents: number; lineTotalCents: number };
type Expense = { id?: string; description: string; amountCents: number };
type Report = {
  id: string;
  gymName: string;
  businessDate: string;
  staffName: string;
  memberships: MoneySplit;
  renewals: MoneySplit;
  vouchers: Voucher[];
  barItems: BarItem[];
  voucherReimbursementCents: number;
  barSalesCents: number;
  grossCents: number;
  expensesTotalCents: number;
  dailyTotalCents: number;
  expenses: Expense[];
  submittedAt: string;
};
type Preview = {
  gymId: string;
  gymName: string;
  businessDate: string;
  submitted: boolean;
  report?: Report | null;
  memberships?: MoneySplit;
  renewals?: MoneySplit;
  vouchers?: Voucher[];
  barItems?: BarItem[];
  voucherReimbursementCents?: number;
  barSalesCents?: number;
  grossCents?: number;
};
type ExpenseDraft = { id: number; description: string; value: string };

function displayDate(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function Split({ title, values }: { title: string; values: MoneySplit }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {([['Cash', values.cashCents], ['Card', values.cardCents], ['Other', values.otherCents]] as const).map(([label, cents]) => (
          <div key={label} className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-xl font-black tabular-nums">{formatBarEuro(cents)}</p></div>
        ))}
      </div>
    </section>
  );
}

function SubmittedReport({ report }: { report: Report }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <p className="text-xs font-black uppercase tracking-widest">End of Day submitted</p>
        <p className="mt-2 text-2xl font-black">{report.gymName} · {displayDate(report.businessDate)}</p>
        <p className="mt-1 text-sm font-bold">Staff: {report.staffName}</p>
      </div>
      <Split title="New Memberships" values={report.memberships} />
      <Split title="Renewals" values={report.renewals} />
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Bar</h2>
        <div className="mt-3 space-y-2">{report.barItems.length ? report.barItems.map((item, index) => <div key={`${item.itemName}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.itemName} × {item.quantity}</span><strong>{formatBarEuro(item.lineTotalCents)}</strong></div>) : <p className="text-sm text-zinc-500">No Bar sales.</p>}</div>
        <p className="mt-4 border-t border-zinc-200 pt-3 text-right text-xl font-black">{formatBarEuro(report.barSalesCents)}</p>
      </section>
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Expenses</h2><div className="mt-3 space-y-2">{report.expenses.length ? report.expenses.map((expense, index) => <div key={expense.id || index} className="flex justify-between gap-3 text-sm"><span>{expense.description}</span><strong>{formatBarEuro(expense.amountCents)}</strong></div>) : <p className="text-sm text-zinc-500">No expenses.</p>}</div></section>
      <section className="rounded-3xl bg-zinc-950 p-5 text-white"><div className="flex justify-between"><span>Gross</span><strong>{formatBarEuro(report.grossCents)}</strong></div><div className="mt-2 flex justify-between"><span>Expenses</span><strong>- {formatBarEuro(report.expensesTotalCents)}</strong></div><div className="mt-4 flex justify-between border-t border-zinc-700 pt-4 text-2xl font-black"><span>End of Day Total</span><span className="text-orange-400">{formatBarEuro(report.dailyTotalCents)}</span></div></section>
    </div>
  );
}

export default function EndOfDayPage() {
  const [data, setData] = useState<Preview | null>(null);
  const [staffName, setStaffName] = useState("");
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nextId, setNextId] = useState(1);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/system/end-of-day", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load End of Day.");
        if (active) setData(payload as Preview);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load End of Day.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const expenseState = useMemo(() => {
    let total = 0;
    let invalid = false;
    const prepared: Array<{ description: string; amountCents: number }> = [];
    for (const row of expenses) {
      const description = row.description.trim();
      const hasValue = Boolean(row.value.trim());
      if (!description && !hasValue) continue;
      const amountCents = parseEuroCents(row.value);
      if (!description || amountCents === null || amountCents <= 0) {
        invalid = true;
        continue;
      }
      total += amountCents;
      prepared.push({ description, amountCents });
    }
    return { total, invalid, prepared };
  }, [expenses]);

  if (loading) return <main className="min-h-screen bg-zinc-50 p-8">Loading End of Day…</main>;
  if (!data) return <main className="min-h-screen bg-zinc-50 p-8"><p role="alert">{error || "Could not load End of Day."}</p><a href="/staff" className="text-orange-700 underline">Staff Home</a></main>;
  if (data.submitted && data.report) {
    return <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8"><div className="mx-auto max-w-4xl"><a href="/staff" className="mb-4 inline-flex items-center gap-1 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4" /> Staff Home</a><SubmittedReport report={data.report} /></div></main>;
  }

  const memberships = data.memberships || { cashCents: 0, cardCents: 0, otherCents: 0 };
  const renewals = data.renewals || { cashCents: 0, cardCents: 0, otherCents: 0 };
  const grossCents = Number(data.grossCents || 0);
  const finalCents = grossCents - expenseState.total;

  async function submit() {
    if (!staffName.trim() || expenseState.invalid) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/system/end-of-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffName: staffName.trim(), expenses: expenseState.prepared }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not submit End of Day.");
      setData((current) => current ? { ...current, submitted: true, report: payload.report } : current);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit End of Day.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-zinc-950 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <a href="/staff" className="inline-flex items-center gap-1 text-sm font-black text-orange-700"><ArrowLeft className="h-4 w-4" /> Staff Home</a>
          <p className="mt-3 text-xs font-black uppercase tracking-widest text-[#ff5a0a]">BestGymsMalta · Staff</p>
          <h1 className="text-3xl font-black">End of Day</h1>
          <p className="mt-2 text-sm font-bold text-zinc-600">{data.gymName} · {displayDate(data.businessDate)}</p>
          <p className="mt-1 text-sm text-zinc-500">Figures below are calculated automatically from today's saved activity.</p>
        </header>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <Split title="New Memberships" values={memberships} />
        <Split title="Renewals" values={renewals} />

        {(data.vouchers || []).length > 0 && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Voucher reimbursements</h2>
            <p className="mt-1 text-xs font-semibold text-zinc-500">These reimbursements are already included in New Membership Card sales.</p>
            <div className="mt-4 space-y-2">{(data.vouchers || []).map((voucher) => <div key={voucher.voucherCode} className="flex justify-between gap-3 rounded-xl bg-zinc-50 p-3 text-sm"><span className="font-bold">{voucher.voucherCode} × {voucher.quantity}</span><strong>{formatBarEuro(voucher.reimbursementTotalCents)}</strong></div>)}</div>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black">Bar</h2><p className="mt-1 text-sm text-zinc-500">Today's live Bar sheet.</p></div><strong className="text-2xl font-black">{formatBarEuro(Number(data.barSalesCents || 0))}</strong></div>
          <div className="mt-4 space-y-2">{(data.barItems || []).length ? (data.barItems || []).map((item, index) => <div key={`${item.itemName}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.itemName} × {item.quantity}</span><strong>{formatBarEuro(item.lineTotalCents)}</strong></div>) : <p className="text-sm text-zinc-500">No Bar sales today.</p>}</div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Expenses</h2><p className="mt-1 text-sm text-zinc-500">Add each expense paid today.</p></div><button type="button" onClick={() => { setExpenses((current) => [...current, { id: nextId, description: "", value: "" }]); setNextId((value) => value + 1); }} className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700"><Plus className="h-4 w-4" /> Add expense</button></div>
          <div className="mt-4 space-y-3">{expenses.map((row) => <div key={row.id} className="grid gap-3 rounded-2xl bg-zinc-50 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"><label className="text-xs font-black text-zinc-600">Description<input aria-label={`Expense ${row.id} description`} value={row.description} onChange={(event) => setExpenses((current) => current.map((item) => item.id === row.id ? { ...item, description: event.target.value } : item))} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950" /></label><label className="text-xs font-black text-zinc-600">Value €<input aria-label={`Expense ${row.id} value`} inputMode="decimal" value={row.value} onChange={(event) => setExpenses((current) => current.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item))} className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950" placeholder="0.00" /></label><button type="button" aria-label={`Remove expense ${row.id}`} onClick={() => setExpenses((current) => current.filter((item) => item.id !== row.id))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-red-700"><Minus className="h-4 w-4" /></button></div>)}</div>
          {expenseState.invalid && <p className="mt-3 text-sm font-bold text-red-700">Complete both the description and a positive value for every expense row.</p>}
        </section>

        <section className="rounded-3xl bg-zinc-950 p-5 text-white shadow-sm">
          <div className="flex justify-between gap-3 text-sm"><span>Gross income</span><strong>{formatBarEuro(grossCents)}</strong></div>
          <div className="mt-2 flex justify-between gap-3 text-sm"><span>Expenses</span><strong>- {formatBarEuro(expenseState.total)}</strong></div>
          <div className="mt-4 flex justify-between gap-3 border-t border-zinc-700 pt-4 text-2xl font-black"><span>End of Day Total</span><span className="text-orange-400">{formatBarEuro(finalCents)}</span></div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-black">Staff Name <span className="text-red-600">*</span>
            <input aria-label="End of Day Staff Name" value={staffName} onChange={(event) => setStaffName(event.target.value)} maxLength={120} className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base" placeholder="Enter your name" />
          </label>
          <button type="button" onClick={() => void submit()} disabled={submitting || !staffName.trim() || expenseState.invalid}
            className="mt-4 w-full rounded-2xl bg-[#ff5a0a] px-5 py-4 text-lg font-black text-white disabled:opacity-40">
            {submitting ? "SUBMITTING…" : "SUBMIT END OF DAY"}
          </button>
          <p className="mt-2 text-center text-xs font-semibold text-zinc-500">Only one End of Day can be submitted for this gym today. Submitting locks today's Bar sheet.</p>
        </section>
      </div>
    </main>
  );
}
