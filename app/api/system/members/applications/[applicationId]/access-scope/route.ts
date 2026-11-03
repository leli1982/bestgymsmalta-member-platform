import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const VALID_SCOPES = new Set(["network", "single_gym", "neptunes_only"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.view");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const body = await request.json();
    const requestedScope = clean(body.accessScope).toLowerCase();
    if (!VALID_SCOPES.has(requestedScope)) {
      return NextResponse.json({ error: "Select All Access or Single Gym access." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id,application_kind,enrollment_gym_id,status,access_scope,access_gym_id,membership_type,duration_key,base_price_cents,price_catalog_version_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }

    const requiredPermission = application.application_kind === "renewal" ? "members.renew" : "members.create";
    if (!auth.context.isSuperAdmin && !auth.context.permissions.includes(requiredPermission)) {
      return NextResponse.json({ error: "This account cannot change access for this application." }, { status: 403 });
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json({ error: "Access can only be changed before activation." }, { status: 409 });
    }
    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }

    const accessScope = requestedScope === "neptunes_only" ? "single_gym" : requestedScope;
    const accessGymId = accessScope === "single_gym" ? application.enrollment_gym_id : null;

    if (accessScope === "single_gym") {
      const gymResult = await supabase
        .from("bgm_gyms")
        .select("id,status,single_gym_pricing_enabled")
        .eq("id", application.enrollment_gym_id)
        .maybeSingle();
      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data || gymResult.data.status !== "active" || !gymResult.data.single_gym_pricing_enabled) {
        return NextResponse.json({ error: "Single Gym membership is not available for this gym." }, { status: 409 });
      }
    }

    let catalogQuery = supabase
      .from("bgm_membership_price_catalog_versions")
      .select("id")
      .eq("status", "published")
      .eq("access_scope", accessScope);
    catalogQuery = accessGymId
      ? catalogQuery.eq("gym_id", accessGymId)
      : catalogQuery.is("gym_id", null);
    const catalogResult = await catalogQuery
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (catalogResult.error) throw catalogResult.error;
    if (!catalogResult.data) {
      return NextResponse.json({ error: "The selected access price list is not published." }, { status: 409 });
    }

    const priceResult = await supabase
      .from("bgm_membership_price_entries")
      .select("amount_cents,currency,is_active")
      .eq("catalog_version_id", catalogResult.data.id)
      .eq("membership_type", application.membership_type)
      .eq("duration_key", application.duration_key)
      .maybeSingle();
    if (priceResult.error) throw priceResult.error;
    const price = priceResult.data;
    if (!price || price.is_active === false || price.currency !== "EUR" || Number(price.amount_cents) <= 0) {
      return NextResponse.json({ error: "The selected membership price is not available." }, { status: 409 });
    }

    const updateResult = await supabase
      .from("bgm_membership_applications")
      .update({
        access_scope: accessScope,
        access_gym_id: accessGymId,
        base_price_cents: Number(price.amount_cents),
        currency: "EUR",
        price_catalog_version_id: catalogResult.data.id,
        discount_code_id: null,
        discount_code_snapshot: null,
        discount_percentage_snapshot: null,
        discount_amount_cents: 0,
        final_amount_cents: Number(price.amount_cents),
        updated_at: new Date().toISOString(),
      })
      .eq("id", application.id)
      .select("id,access_scope,access_gym_id,base_price_cents,price_catalog_version_id")
      .single();
    if (updateResult.error) throw updateResult.error;

    await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: auth.context.displayName,
      action_key: "membership.access_scope.updated",
      entity_type: "membership_application",
      entity_id: application.id,
      before_data: {
        accessScope: application.access_scope || "network",
        accessGymId: application.access_gym_id || null,
        basePriceCents: application.base_price_cents || null,
        priceCatalogVersionId: application.price_catalog_version_id || null,
      },
      after_data: {
        accessScope,
        accessGymId,
        basePriceCents: Number(price.amount_cents),
        priceCatalogVersionId: catalogResult.data.id,
      },
    });

    return NextResponse.json({
      ok: true,
      accessScope,
      accessGymId,
      basePriceCents: Number(price.amount_cents),
      priceCatalogVersionId: catalogResult.data.id,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update membership access." }, { status: 500 });
  }
}
