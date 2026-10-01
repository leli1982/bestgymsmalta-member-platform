"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { formatEuropeanDateTime } from "@/lib/europeanDate";

type RefundAlert = {
  id: string;
  member_id: string;
  voucher_code: string;
  voucher_percentage: number;
  refund_due_cents: number;
  currency: string;
  member_first_name: string | null;
  member_last_name: string | null;
  member_id_number: string | null;
  member_mobile: string | null;
  status: "pending" | "handled";
  created_at: string;
  email_notification_status: string;
};

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-MT", { style: "currency", currency: currency || "EUR" }).format(cents / 100);
}

export default function SuperAdminRefundAlerts() {
  const [alerts, setAlerts] = useState<RefundAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/system/refund-alerts?status=pending", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load refund alerts.");
      setAlerts(body.alerts || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load refund alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markHandled(alertId: string) {
    if (busy) return;
    if (!window.confirm("Mark this member refund as completed?")) return;
    setBusy(alertId); setError("");
    try {
      const response = await fetch("/api/system/refund-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update refund alert.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update refund alert.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-red-800">
            <TriangleAlert className="h-6 w-6"/>
            <h2 className="text-xl font-black">Refunds required</h2>
          </div>
          <p className="mt-1 text-sm font-semibold text-red-900">
            Persistent Super Admin alerts created when a voucher is applied after a member has already paid.
          </p>
        </div>
        <span className="rounded-full bg-red-700 px-3 py-1 text-sm font-black text-white">{alerts.length} pending</span>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-red-800">{error}</p>}
      {loading ? <p className="mt-4 text-sm font-semibold text-red-900">Loading refund alerts…</p> : null}
      {!loading && alerts.length === 0 ? <p className="mt-4 text-sm font-semibold text-red-900">No refunds are currently pending.</p> : null}
      <div className="mt-4 space-y-3">
        {alerts.map((alert) => {
          const fullName = [alert.member_first_name, alert.member_last_name].filter(Boolean).join(" ") || "Member";
          return (
            <article key={alert.id} className="rounded-2xl border border-red-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">{fullName}</h3>
                  <p className="mt-1 text-sm"><strong>ID:</strong> {alert.member_id_number || "Not recorded"} · <strong>Mobile:</strong> {alert.member_mobile || "Not recorded"}</p>
                  <p className="mt-1 text-sm"><strong>Voucher:</strong> {alert.voucher_code} ({alert.voucher_percentage}%) · <strong>Email:</strong> {alert.email_notification_status}</p>
                  <p className="mt-1 text-xs text-zinc-500">Created {formatEuropeanDateTime(alert.created_at)}</p>
                  <a href={"/staff/admin/members/" + encodeURIComponent(alert.member_id)} className="mt-2 inline-block text-sm font-black text-orange-700 underline">Open member</a>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-wide text-red-700">Refund due</p>
                  <p className="text-2xl font-black text-red-800">{money(alert.refund_due_cents, alert.currency)}</p>
                  <button type="button" disabled={busy !== ""} onClick={() => void markHandled(alert.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4"/>{busy === alert.id ? "Saving…" : "Mark refunded"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
