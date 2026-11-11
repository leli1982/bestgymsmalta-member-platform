import { NextRequest, NextResponse } from "next/server";
import { normalizeDiscountCode } from "@/lib/membershipSettingsCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { matchingVoucherApprovalTerms, voucherApprovalTermsFromRow, type VoucherApprovalTerms } from "@/lib/voucherApprovalCore";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store, max-age=0" };

// Staff poll the durable approval status; never trust a client-side approval flag.
export async function GET(request: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  try {
    const auth = await requireSystemPermission(request,"membership.activate");
    if (auth.error || !auth.context) return auth.error;
    const { applicationId } = await params;
    const code = normalizeDiscountCode(request.nextUrl.searchParams.get("code") || "");
    if (!code) return NextResponse.json({ status:"not_required" },{ headers:noStore });

    const db = getSupabaseAdmin();
    const application = await db.from("bgm_membership_applications")
      .select("id,enrollment_gym_id,status")
      .eq("id",applicationId).maybeSingle();
    if (application.error) throw application.error;
    if (!application.data) return NextResponse.json({ error:"Membership application not found." },{ status:404,headers:noStore });
    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.data.enrollment_gym_id) {
      return NextResponse.json({ error:"This application belongs to another gym." },{ status:403,headers:noStore });
    }

    const voucher = await db.from("bgm_discount_codes")
      .select("id,code,percentage,active,valid_from,valid_until,max_uses,reimbursement_value_cents,requires_verification")
      .eq("code",code).maybeSingle();
    if (voucher.error) throw voucher.error;
    if (!voucher.data || !voucher.data.requires_verification)
      return NextResponse.json({ status:"not_required" },{ headers:noStore });

    const result = await db.from("bgm_voucher_approval_requests")
      .select("id,status,voucher_terms,decision_note,requested_at")
      .eq("application_id",applicationId)
      .eq("voucher_id",voucher.data.id)
      .order("requested_at",{ ascending:false })
      .limit(25);
    if (result.error) throw result.error;
    const currentTerms = voucherApprovalTermsFromRow(voucher.data);
    const current = (result.data || []).find(row => matchingVoucherApprovalTerms(row.voucher_terms as VoucherApprovalTerms,currentTerms));
    const newest = result.data?.[0];

    return NextResponse.json({
      status: current?.status === "cancelled" ? "not_requested" :
        current?.status || (newest ? "stale" : "not_requested"),
      note: current?.status === "rejected" ? current.decision_note : null,
      requestId:current?.id || null,
    },{ headers:noStore });
  } catch (error) {
    console.error("Could not load staff voucher approval status.",error);
    return NextResponse.json({error:"Could not check voucher approval."},{status:500,headers:noStore});
  }
}
