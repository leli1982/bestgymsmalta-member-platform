import { NextRequest, NextResponse } from "next/server";
import {
  discountAmountCents,
  normalizeDiscountCode,
} from "@/lib/membershipSettingsCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { sendVoucherApprovalPush } from "@/lib/voucherApprovalPush";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "membership.activate");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const body = await request.json();
    const code = normalizeDiscountCode(String(body.code ?? ""));

    if (!code) {
      return NextResponse.json({ error: "Enter a discount code." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select(
        "id, enrollment_gym_id, status, membership_type, duration_key, base_price_cents, currency, price_catalog_version_id, submitted_at"
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json(
        { error: "This membership application is no longer awaiting payment." },
        { status: 409 }
      );
    }
    if (
      !auth.context.isSuperAdmin &&
      auth.context.gymId !== application.enrollment_gym_id
    ) {
      return NextResponse.json(
        { error: "This application belongs to another gym." },
        { status: 403 }
      );
    }

    let basePriceCents = application.base_price_cents as number | null;
    let currency = String(application.currency || "EUR");
    let priceCatalogVersionId = application.price_catalog_version_id as string | null;

    if (basePriceCents == null || !priceCatalogVersionId) {
      if (!application.submitted_at) {
        return NextResponse.json({ error: "The original application date is unavailable; review the historical price rather than repricing it." }, { status: 409 });
      }
      const catalogResult = await supabase
        .from("bgm_membership_price_catalog_versions")
        .select("id, version_no, published_at")
        .in("status", ["published", "retired"])
        .lte("published_at", application.submitted_at)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (catalogResult.error) throw catalogResult.error;
      if (!catalogResult.data) {
        return NextResponse.json(
          { error: "Published Super Admin membership rate was not found." },
          { status: 409 }
        );
      }

      const priceResult = await supabase
        .from("bgm_membership_price_entries")
        .select("amount_cents, currency")
        .eq("catalog_version_id", catalogResult.data.id)
        .eq("membership_type", application.membership_type)
        .eq("duration_key", application.duration_key)
        .maybeSingle();

      if (priceResult.error) throw priceResult.error;
      if (!priceResult.data) {
        return NextResponse.json(
          { error: "Published Super Admin membership rate was not found." },
          { status: 409 }
        );
      }

      basePriceCents = basePriceCents ?? priceResult.data.amount_cents;
      currency = priceResult.data.currency || "EUR";
      priceCatalogVersionId = catalogResult.data.id;
    }

    if (basePriceCents == null) {
      return NextResponse.json(
        { error: "Published Super Admin membership rate was not found." },
        { status: 409 }
      );
    }

    const discountResult = await supabase
      .from("bgm_discount_codes")
      .select(
        "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses, requires_verification"
      )
      .eq("code", code)
      .maybeSingle();

    if (discountResult.error) throw discountResult.error;
    const discount = discountResult.data;
    const today = todayMaltaDate();

    if (
      !discount ||
      !discount.active ||
      (discount.valid_from && today < discount.valid_from) ||
      (discount.valid_until && today > discount.valid_until) ||
      (discount.max_uses !== null &&
        discount.successful_uses >= discount.max_uses)
    ) {
      return NextResponse.json(
        { error: "Discount code is unavailable." },
        { status: 409 }
      );
    }

    const amount = discountAmountCents(basePriceCents, discount.percentage);
    const finalAmount = Math.max(basePriceCents - amount, 0);

    let approvalStatus = "not_required";
    if (discount.requires_verification) {
      // Only the database RPC may create a pending request. It serializes with
      // the activation RPC and deduplicates repeated staff Apply Code clicks.
      const approvalResult = await supabase.rpc("bgm_request_voucher_approval", {
        p_application_id: applicationId,
        p_voucher_code: code,
        p_system_user_id: auth.context.systemUserId,
      });
      if (approvalResult.error) {
        return NextResponse.json(
          { error: String(approvalResult.error.message || "Voucher approval could not be requested.") },
          { status: 409 }
        );
      }
      approvalStatus = String(approvalResult.data?.status || "pending");
      if (approvalResult.data?.created) {
        // Persistent Super Admin inbox was written transactionally above.
        // Push delivery is optional and must never duplicate or rollback requests.
        try {
          const gymResult = await supabase.from("bgm_gyms")
            .select("name").eq("id", application.enrollment_gym_id).maybeSingle();
          await sendVoucherApprovalPush({
            requestId: approvalResult.data.id,
            voucherCode: discount.code,
            gymName: gymResult.data?.name || application.enrollment_gym_id,
          });
        } catch (pushError) {
          console.error("Voucher approval push unavailable; inbox request retained.", pushError);
        }
      }
    }

    return NextResponse.json({
      code: discount.code,
      percentage: discount.percentage,
      basePriceCents,
      discountAmountCents: amount,
      finalAmountCents: finalAmount,
      currency,
      priceCatalogVersionId,
      requiresVerification: discount.requires_verification === true,
      approvalStatus,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not validate the discount code." },
      { status: 500 }
    );
  }
}
