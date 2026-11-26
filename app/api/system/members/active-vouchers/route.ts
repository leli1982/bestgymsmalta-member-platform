import { NextRequest, NextResponse } from "next/server";
import { hasAdvancedVoucherTerms, isVoucherEligible, type VoucherPromotion } from "@/lib/voucherDurationCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

type VoucherRow = VoucherPromotion & {
  code: string;
  percentage: number;
  requires_verification: boolean;
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

    const supabase = getSupabaseAdmin();
    const applicationId = request.nextUrl.searchParams.get("applicationId");
    const applicationResult = applicationId ? await supabase.from("bgm_membership_applications")
      .select("id, enrollment_gym_id, membership_type, duration_key, application_kind, status")
      .eq("id", applicationId).maybeSingle() : null;
    if (applicationResult?.error) throw applicationResult.error;
    const application = applicationResult?.data;
    if (applicationId && (!application || (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id))) {
      return NextResponse.json({ error: "Membership application is unavailable." }, { status: 404 });
    }
    const result = await supabase
      .from("bgm_discount_codes")
      .select("code, percentage, requires_verification, active, valid_from, valid_until, max_uses, successful_uses, extension_months, eligible_duration_keys, eligible_membership_types, eligible_application_kinds, eligible_gym_ids")
      .eq("active", true)
      .order("code", { ascending: true });

    if (result.error) throw result.error;

    const today = todayMaltaDate();
    const vouchers = ((result.data || []) as VoucherRow[])
      .filter((voucher) => voucherAvailableToday(voucher, today))
      .filter((voucher) => application ? isVoucherEligible(voucher, application) : !hasAdvancedVoucherTerms(voucher))
      .map(({ code, percentage, requires_verification, extension_months }) => ({ code, percentage, requiresVerification: requires_verification, extensionMonths: extension_months }));

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
