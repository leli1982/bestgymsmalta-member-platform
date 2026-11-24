import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { scopedConflictCandidates } from "@/lib/scopedCardConflictCandidates";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSystemPermission(request, "barcode.scan");
    if (auth.error || !auth.context) return auth.error;
    const { scanId } = await request.json();
    if (typeof scanId !== "string") return NextResponse.json({ error: "Scan required." }, { status: 400 });
    const db = getSupabaseAdmin();
    const scan = await db.from("bgm_access_scans")
      .select("id,credential_value,gym_id,system_user_id,result")
      .eq("id", scanId).maybeSingle();
    if (scan.error) throw scan.error;
    if (!scan.data || scan.data.result !== "ambiguous_card" ||
        scan.data.system_user_id !== auth.context.systemUserId ||
        scan.data.gym_id !== (auth.context.gymId || scan.data.gym_id)) {
      return NextResponse.json({ error: "This card conflict scan is unavailable." }, { status: 403 });
    }
    const claims = await db.from("bgm_legacy_card_claims")
      .select("member_id").eq("scan3", scan.data.credential_value.toUpperCase())
      .eq("assignment_status", "active");
    if (claims.error) throw claims.error;

    let memberIds = (claims.data || []).map((claim) => claim.member_id);
    if (!memberIds.length) {
      const legacyMatches = await db.from("bgm_members")
        .select("id")
        .eq("legacy_pk_customer", scan.data.credential_value)
        .neq("status", "archived")
        .limit(50);
      if (legacyMatches.error) throw legacyMatches.error;
      memberIds = (legacyMatches.data || []).map((member) => member.id);
    }

    // For the 32 exception scans, include unassigned source candidates plus
    // any currently assigned modern-card owner. Only these codes are affected.
    const scoped = scopedConflictCandidates(scan.data.credential_value);
    if (scoped.length) {
      const [candidates, current] = await Promise.all([
        db.from("bgm_members").select("id").in("member_number", scoped).is("archived_at", null),
        db.from("bgm_member_card_credentials").select("member_id")
          .ilike("barcode_value", scan.data.credential_value).eq("status", "active"),
      ]);
      if (candidates.error) throw candidates.error;
      if (current.error) throw current.error;
      memberIds = Array.from(new Set([
        ...memberIds,
        ...(candidates.data || []).map(m => m.id),
        ...(current.data || []).map(c => c.member_id).filter((id): id is string => Boolean(id)),
      ]));
    }

    const people = memberIds.length ? await db.from("bgm_members")
      .select("id,status,membership_expiry,cancellation_effective_date")
      .in("id", Array.from(new Set(memberIds))) : { data: [], error: null };
    if (people.error) throw people.error;
    const conflictMembers = (people.data || []).filter((m) => m.status !== "archived");
    if (conflictMembers.length < 2) {
      return NextResponse.json({ error: "The card is no longer conflicted." }, { status: 409 });
    }
    let review = await db.from("bgm_card_conflict_reviews").select("id")
      .eq("scan3", scan.data.credential_value.toUpperCase()).eq("status", "unresolved").maybeSingle();
    if (review.error) throw review.error;
    if (!review.data) {
      const created = await db.from("bgm_card_conflict_reviews").insert({
        scan3: scan.data.credential_value.toUpperCase(), gym_id: scan.data.gym_id,
        requested_by_system_user_id: auth.context.systemUserId,
      }).select("id").single();
      if (created.error && created.error.code !== "23505") throw created.error;
      review = created.error
        ? await db.from("bgm_card_conflict_reviews").select("id")
          .eq("scan3", scan.data.credential_value.toUpperCase()).eq("status", "unresolved").single()
        : created;
      if (review.error) throw review.error;
    }
    const flag = await db.from("bgm_card_conflict_flags").insert({
      review_id: review.data!.id, scan3: scan.data.credential_value.toUpperCase(),
      gym_id: scan.data.gym_id, system_user_id: auth.context.systemUserId,
      scan_id: scan.data.id, member_ids: conflictMembers.map((m) => m.id),
    });
    if (flag.error) throw flag.error;
    return NextResponse.json({ reviewId: review.data!.id, status: "unresolved" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not flag card conflict." }, { status: 500 });
  }
}
