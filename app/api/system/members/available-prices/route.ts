import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

async function loadPublishedEntries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  accessScope: "network" | "single_gym",
  gymId: string | null,
) {
  let catalogQuery = supabase
    .from("bgm_membership_price_catalog_versions")
    .select("id")
    .eq("status", "published")
    .eq("access_scope", accessScope);

  catalogQuery = gymId
    ? catalogQuery.eq("gym_id", gymId)
    : catalogQuery.is("gym_id", null);

  const catalog = await catalogQuery
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (catalog.error) throw catalog.error;
  if (!catalog.data) return null;

  const prices = await supabase
    .from("bgm_membership_price_entries")
    .select("membership_type,duration_key,amount_cents,is_active")
    .eq("catalog_version_id", catalog.data.id)
    .eq("is_active", true)
    .gt("amount_cents", 0);
  if (prices.error) throw prices.error;

  return {
    catalogVersionId: catalog.data.id,
    entries: (prices.data || []).map((entry) => ({
      membershipType: entry.membership_type,
      durationKey: entry.duration_key,
      amountCents: entry.amount_cents,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.renew");
    if (auth.error || !auth.context) return auth.error;

    const requestedGymId = String(request.nextUrl.searchParams.get("gymId") || "").trim();
    if (!auth.context.isSuperAdmin && requestedGymId && requestedGymId !== auth.context.gymId) {
      return NextResponse.json({ error: "You can only load rates for your assigned gym." }, { status: 403 });
    }
    const gymId = auth.context.isSuperAdmin ? requestedGymId || null : auth.context.gymId;

    const supabase = getSupabaseAdmin();
    const network = await loadPublishedEntries(supabase, "network", null);
    if (!network) {
      return NextResponse.json({ error: "Published membership rates are unavailable." }, { status: 503 });
    }

    let singleGymEnabled = false;
    let singleGym: Awaited<ReturnType<typeof loadPublishedEntries>> = null;
    if (gymId) {
      const gym = await supabase
        .from("bgm_gyms")
        .select("id,single_gym_pricing_enabled,status")
        .eq("id", gymId)
        .maybeSingle();
      if (gym.error) throw gym.error;
      singleGymEnabled = Boolean(
        gym.data?.status === "active" && gym.data?.single_gym_pricing_enabled,
      );
      if (singleGymEnabled) {
        singleGym = await loadPublishedEntries(supabase, "single_gym", gymId);
      }
    }

    const guardianResult = await supabase
      .from("bgm_membership_declaration_versions")
      .select("id,version_no,body,content_sha256")
      .eq("content_key", "guardian")
      .eq("status", "published")
      .maybeSingle();
    if (guardianResult.error) throw guardianResult.error;

    return NextResponse.json({
      catalogVersionId: network.catalogVersionId,
      entries: network.entries,
      singleGymEnabled,
      singleGymCatalogVersionId: singleGym?.catalogVersionId || null,
      singleGymEntries: singleGym?.entries || [],
      guardianDeclaration: guardianResult.data ? {
        id: guardianResult.data.id,
        versionNo: Number(guardianResult.data.version_no),
        body: guardianResult.data.body,
        contentSha256: guardianResult.data.content_sha256,
      } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load published renewal prices:", error);
    return NextResponse.json({ error: "Could not load published membership rates." }, { status: 500 });
  }
}
