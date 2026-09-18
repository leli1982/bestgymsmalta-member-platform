import { NextRequest, NextResponse } from "next/server";
import {
  discountAmountCents,
  normalizeDiscountCode,
} from "@/lib/membershipSettingsCore";
import { todayMaltaDate } from "@/lib/maltaDate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

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
        "id, enrollment_gym_id, status, membership_type, duration_key, base_price_cents, currency, price_catalog_version_id"
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
      const catalogResult = await supabase
        .from("bgm_membership_price_catalog_versions")
        .select("id, version_no")
        .eq("status", "published")
        .order("version_no", { ascending: false })
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

      basePriceCents = priceResult.data.amount_cents;
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
        "id, code, percentage, active, valid_from, valid_until, max_uses, successful_uses"
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

    return NextResponse.json({
      code: discount.code,
      percentage: discount.percentage,
      basePriceCents,
      discountAmountCents: amount,
      finalAmountCents: finalAmount,
      currency,
      priceCatalogVersionId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not validate the discount code." },
      { status: 500 }
    );
  }
}
