import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import {
  loadPublishedEnrollmentPriceCatalog,
  normalizeEnrollmentAccessScope,
} from "@/lib/scopedMembershipPricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
const MEMBERSHIP_TYPES = new Set(["single", "student", "couples"]);
const DURATION_KEYS = new Set(["1_week", "2_weeks", "1_month", "3_months", "6_months", "1_year"]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers });
}

/**
 * Read-only payment preview. Never writes an application or changes historical
 * prices. An unchanged selection keeps its original snapshotted amount; editing
 * the product previews the currently published price that the database's
 * membership-application UPDATE trigger will use when staff save the review.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const membershipType = request.nextUrl.searchParams.get("membershipType") || "";
    const durationKey = request.nextUrl.searchParams.get("durationKey") || "";

    if (!MEMBERSHIP_TYPES.has(membershipType) || !DURATION_KEYS.has(durationKey)) {
      return fail("Select a valid membership type and duration.", 400);
    }

    const db = getSupabaseAdmin();
    const result = await db.from("bgm_membership_applications")
      .select("id,status,enrollment_gym_id,access_scope,access_gym_id,membership_type,duration_key,base_price_cents,currency,price_catalog_version_id")
      .eq("id", applicationId).maybeSingle();
    if (result.error) throw result.error;
    const application = result.data;
    if (!application) return fail("Membership application not found.", 404);
    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return fail("This application belongs to another gym.", 403);
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return fail("This membership application is no longer awaiting payment.", 409);
    }

    const unchanged = membershipType === application.membership_type &&
      durationKey === application.duration_key;
    if (unchanged) {
      if (!Number.isSafeInteger(application.base_price_cents) ||
          application.base_price_cents < 0 || !application.price_catalog_version_id) {
        return fail("The saved price is unavailable. Reopen the application before taking payment.", 409);
      }
      return NextResponse.json({
        membershipType, durationKey,
        basePriceCents: application.base_price_cents,
        currency: application.currency || "EUR",
        priceCatalogVersionId: application.price_catalog_version_id,
        source: "saved",
      }, { headers });
    }

    const accessScope = normalizeEnrollmentAccessScope(application.access_scope);
    if (!accessScope) return fail("Membership access scope is invalid.", 409);
    const gymId = accessScope === "single_gym" ? application.access_gym_id : null;
    if (accessScope === "single_gym" && !gymId) {
      return fail("The Single Gym membership has no assigned access gym.", 409);
    }

    const catalog = await loadPublishedEnrollmentPriceCatalog(db, accessScope, gymId);
    const match = catalog?.entries.find(entry =>
      entry.membershipType === membershipType && entry.durationKey === durationKey,
    );
    if (!match || !Number.isSafeInteger(match.amountCents) || match.amountCents <= 0) {
      return fail("This membership duration is not available at a published price.", 409);
    }
    return NextResponse.json({
      membershipType, durationKey,
      basePriceCents: match.amountCents,
      currency: match.currency,
      priceCatalogVersionId: catalog!.versionId,
      source: "current",
    }, { headers });
  } catch (error) {
    console.error("Membership payment price preview failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to confirm the price. Do not take payment yet.", 500);
  }
}
