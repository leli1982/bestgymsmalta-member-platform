"use client";

import EuropeanDateInput from "@/components/ui/EuropeanDateInput";
import { formatEuropeanDate } from "@/lib/europeanDate";
import { todayMaltaDate } from "@/lib/maltaDate";
import {
  Printer,
  RefreshCw,
  Search,
  TicketCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Voucher = {
  id: string | null;
  code: string;
  percentage: number | null;
  status: "active" | "inactive";
  statusReason: string;
  configuredActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  successfulUses: number;
  membersInRange: number;
};

type VoucherMember = {
  applicationId: string;
  voucherCode: string;
  voucherPercentage: number | null;
  firstName: string;
  lastName: string;
  idNumber: string;
  enrollmentDate: string;
  enrollmentGymId: string | null;
  enrollmentGymName: string;
};

type VoucherData = {
  from: string;
  to: string;
  vouchers: Voucher[];
  members: VoucherMember[];
  summary: {
    totalVouchers: number;
    activeVouchers: number;
    inactiveVouchers: number;
    membersInRange: number;
  };
};

function StatusBadge({ voucher }: { voucher: Voucher }) {
  const active = voucher.status === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function validity(voucher: Voucher) {
  if (!voucher.validFrom && !voucher.validUntil) return "No date limit";
  if (voucher.validFrom && voucher.validUntil) {
    return `${formatEuropeanDate(voucher.validFrom)} – ${formatEuropeanDate(voucher.validUntil)}`;
  }
  if (voucher.validFrom) return `From ${formatEuropeanDate(voucher.validFrom)}`;
  return `Until ${formatEuropeanDate(voucher.validUntil)}`;
}

export default function VoucherAnalyticsAdmin() {
  const today = useMemo(() => todayMaltaDate(), []);
  const [from, setFrom] = useState(() => `${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedVoucher, setSelectedVoucher] = useState("");
  const [data, setData] = useState<VoucherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(
        "/api/system/voucher-analytics?" + params.toString(),
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load vouchers.");
      setData(json);
      if (
        selectedVoucher &&
        !(json.vouchers || []).some((voucher: Voucher) => voucher.code === selectedVoucher)
      ) {
        setSelectedVoucher("");
      }
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load vouchers.");
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedVoucher]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredVouchers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (data?.vouchers || []).filter((voucher) => {
      if (statusFilter !== "all" && voucher.status !== statusFilter) return false;
      if (needle && !voucher.code.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data?.vouchers, search, statusFilter]);

  const visibleCodes = useMemo(
    () => new Set(filteredVouchers.map((voucher) => voucher.code)),
    [filteredVouchers]
  );

  const visibleMembers = useMemo(() => {
    return (data?.members || []).filter((member) => {
      if (selectedVoucher) return member.voucherCode === selectedVoucher;
      return visibleCodes.has(member.voucherCode);
    });
  }, [data?.members, selectedVoucher, visibleCodes]);

  function setPreset(kind: "30" | "90" | "year") {
    const date = new Date(today + "T12:00:00Z");
    if (kind === "30") date.setUTCDate(date.getUTCDate() - 29);
    if (kind === "90") date.setUTCDate(date.getUTCDate() - 89);
    if (kind === "year") date.setUTCMonth(0, 1);
    setFrom(date.toISOString().slice(0, 10));
    setTo(today);
  }

  function openPrint(voucherCode?: string) {
    const params = new URLSearchParams({ from, to });
    if (voucherCode) params.set("voucher", voucherCode);
    window.open(
      "/staff/admin/statistics/vouchers/print?" + params.toString(),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-5" data-super-admin-vouchers="membership-vouchers">
      <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-start gap-3">
          <TicketCheck className="mt-0.5 h-6 w-6 text-orange-700" />
          <div>
            <h3 className="font-black text-orange-950">Membership vouchers</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-orange-900">
              All configured voucher/discount codes are reported here, regardless of discount percentage. Historical usage stays visible even after a voucher is disabled, expires or is removed.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-5 lg:items-end">
        <label className="text-sm font-black lg:col-span-2">
          Search voucher name
          <div className="mt-1 flex items-center rounded-xl border border-zinc-300 bg-white px-3">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. BET365"
              className="w-full bg-transparent px-2 py-3 text-sm outline-none"
            />
          </div>
        </label>

        <label className="text-sm font-black">
          Status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "active" | "inactive")
            }
            className="mt-1 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm"
          >
            <option value="all">All vouchers</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </label>

        <label className="text-sm font-black">
          Enrolled from
          <EuropeanDateInput
            value={from}
            onValueChange={setFrom}
            className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
          />
        </label>

        <label className="text-sm font-black">
          Enrolled to
          <EuropeanDateInput
            value={to}
            onValueChange={setTo}
            className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-3 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-2 lg:col-span-5">
          <button type="button" onClick={() => setPreset("30")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Last 30 days</button>
          <button type="button" onClick={() => setPreset("90")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">Last 90 days</button>
          <button type="button" onClick={() => setPreset("year")} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800">This year</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{error}</p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">Vouchers</p>
              <p className="mt-2 text-3xl font-black">{data.summary.totalVouchers}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Active</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">{data.summary.activeVouchers}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-100 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-600">Inactive</p>
              <p className="mt-2 text-3xl font-black text-zinc-950">{data.summary.inactiveVouchers}</p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-orange-700">Members in date range</p>
              <p className="mt-2 text-3xl font-black text-orange-950">{visibleMembers.length}</p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4">
              <div>
                <h3 className="font-black">Voucher register</h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  Select a voucher to view only its employees below.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!selectedVoucher}
                  onClick={() => selectedVoucher && openPrint(selectedVoucher)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-black disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" /> Print selected voucher
                </button>
                <button
                  type="button"
                  onClick={() => openPrint()}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-black text-white"
                >
                  <Printer className="h-4 w-4" /> Print all vouchers
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Voucher</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Validity</th>
                    <th className="px-4 py-3">Total uses</th>
                    <th className="px-4 py-3">Maximum successful uses</th>
                    <th className="px-4 py-3">Members in range</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((voucher) => (
                    <tr
                      key={voucher.code}
                      className={`border-t border-zinc-100 ${
                        selectedVoucher === voucher.code ? "bg-orange-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-black">{voucher.code}</p>
                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">{voucher.statusReason}</p>
                      </td>
                      <td className="px-4 py-3 font-black tabular-nums">
                        {voucher.percentage === null ? "—" : `${voucher.percentage}%`}
                      </td>
                      <td className="px-4 py-3"><StatusBadge voucher={voucher} /></td>
                      <td className="px-4 py-3 font-semibold">{validity(voucher)}</td>
                      <td className="px-4 py-3 tabular-nums">{voucher.successfulUses}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {voucher.maxUses === null ? "N/A" : voucher.maxUses}
                      </td>
                      <td className="px-4 py-3 font-black tabular-nums">{voucher.membersInRange}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedVoucher(
                              selectedVoucher === voucher.code ? "" : voucher.code
                            )
                          }
                          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800"
                        >
                          {selectedVoucher === voucher.code ? "Show all" : "View members"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center font-semibold text-zinc-500">No vouchers match this search.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-4">
              <h3 className="font-black">
                {selectedVoucher ? `${selectedVoucher} member list` : "Voucher member list"}
              </h3>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                Enrollments from {formatEuropeanDate(from)} to {formatEuropeanDate(to)}.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Surname</th>
                    <th className="px-4 py-3">ID Number</th>
                    <th className="px-4 py-3">Enrollment Date</th>
                    <th className="px-4 py-3">Gym</th>
                    <th className="px-4 py-3">Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member, index) => (
                    <tr key={member.applicationId + member.voucherCode + index} className="border-t border-zinc-100">
                      <td className="px-4 py-3 font-semibold">{member.firstName || "—"}</td>
                      <td className="px-4 py-3 font-black">{member.lastName || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{member.idNumber || "—"}</td>
                      <td className="px-4 py-3">{formatEuropeanDate(member.enrollmentDate)}</td>
                      <td className="px-4 py-3">{member.enrollmentGymName}</td>
                      <td className="px-4 py-3 font-black text-orange-700">{member.voucherCode}</td>
                    </tr>
                  ))}
                  {visibleMembers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center font-semibold text-zinc-500">No voucher enrollments in this date range.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : loading ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm font-semibold text-zinc-500">Loading voucher analytics…</p>
      ) : null}
    </div>
  );
}
