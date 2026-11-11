import { NextRequest, NextResponse } from "next/server";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

type VoucherRow = {
  code: string;
  percentage: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  successful_uses: number;
};

function voucherAvailableToday(voucher: VoucherRow, today: string): boolean {
  return voucher.active === true &&
    (!voucher.valid_from || voucher.valid_from <= today) &&
    (!voucher.valid_until || voucher.valid_until >= today) &&
    (voucher.max_uses === null || voucher.successful_uses < voucher.max_uses);
}

// Read-only options. Existing discount preview and paid activation retain
// their current server-side voucher validation and reimbursement rules.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "membership.activate");
    if (auth.error || !auth.context) return auth.error;

    const result = await getSupabaseAdmin()
      .from("bgm_discount_codes")
      .select("code, percentage, active, valid_from, valid_until, max_uses, successful_uses")
      .eq("active", true)
      .order("code", { ascending: true });

    if (result.error) throw result.error;

    const today = todayMaltaDate();
    const vouchers = ((result.data || []) as VoucherRow[])
      .filter((voucher) => voucherAvailableToday(voucher, today))
      .map(({ code, percentage }) => ({ code, percentage }));

    return NextResponse.json(
      { vouchers },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Could not load active staff vouchers.", error);
    return NextResponse.json(
      { error: "Could not load active vouchers." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
