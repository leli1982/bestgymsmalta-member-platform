"use client";

import { useCallback, useEffect, useState } from "react";

type Voucher = { code: string; percentage: number };

type Props = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
};

export default function StaffVoucherSelect({ value, onChange, className }: Props) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadVouchers = useCallback(async () => {
    try {
      const response = await fetch("/api/system/members/active-vouchers", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.vouchers)) {
        throw new Error("Could not load active vouchers.");
      }
      setVouchers(payload.vouchers);
      setError("");
    } catch {
      setError("Vouchers unavailable — select this field to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const listed = vouchers.some((voucher) => voucher.code === value);

  return (
    <>
      <select
        aria-label="Discount code"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => void loadVouchers()}
        className={className}
      >
        <option value="">No voucher</option>
        {vouchers.map((voucher) => (
          <option key={voucher.code} value={voucher.code}>
            {voucher.code} — {voucher.percentage}%
          </option>
        ))}
        {value && !listed && (
          <option value={value} disabled>{value} — no longer available</option>
        )}
      </select>
      {loading && <span className="text-xs font-semibold text-zinc-500">Loading active vouchers…</span>}
      {error && <span role="alert" className="text-xs font-semibold text-red-700">{error}</span>}
    </>
  );
}
