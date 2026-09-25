import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

// Read only the current published catalog. Drafts must never affect reception.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "members.renew");
    if (auth.error) return auth.error;

    const supabase = getSupabaseAdmin();
    const catalog = await supabase
      .from("bgm_membership_price_catalog_versions")
      .select("id")
      .eq("status", "published")
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (catalog.error) throw catalog.error;
    if (!catalog.data) {
      return NextResponse.json({ error: "Published membership rates are unavailable." }, { status: 503 });
    }

    const prices = await supabase
      .from("bgm_membership_price_entries")
      .select("membership_type,duration_key,amount_cents,is_active")
      .eq("catalog_version_id", catalog.data.id)
      .eq("is_active", true)
      .gt("amount_cents", 0);
    if (prices.error) throw prices.error;

    // The guardian declaration is supplied alongside published rates so the
    // staff renewal form can present the exact current version to minors.
    const guardianResult = await supabase
      .from("bgm_membership_declaration_versions")
      .select("id,version_no,body,content_sha256")
      .eq("content_key", "guardian")
      .eq("status", "published")
      .maybeSingle();
    if (guardianResult.error) throw guardianResult.error;

    return NextResponse.json({
      catalogVersionId: catalog.data.id,
      guardianDeclaration: guardianResult.data ? {
        id: guardianResult.data.id,
        versionNo: Number(guardianResult.data.version_no),
        body: guardianResult.data.body,
        contentSha256: guardianResult.data.content_sha256,
      } : null,
      entries: (prices.data || []).map((entry) => ({
        membershipType: entry.membership_type,
        durationKey: entry.duration_key,
        amountCents: entry.amount_cents,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load published renewal prices:", error);
    return NextResponse.json({ error: "Could not load published membership rates." }, { status: 500 });
  }
}
