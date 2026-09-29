import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const [conflicts, reviews] = await Promise.all([
      db.from("bgm_active_card_conflicts").select("scan3,member_ids,member_count").order("scan3"),
      db.from("bgm_card_conflict_reviews")
        .select("id,scan3,gym_id,requested_by_system_user_id,requested_at,status,resolved_at,resolution_note")
        .eq("status", "unresolved").order("requested_at", { ascending: false }),
    ]);
    if (conflicts.error) throw conflicts.error;
    if (reviews.error) throw reviews.error;
    const memberIds = Array.from(new Set((conflicts.data || []).flatMap((row) => row.member_ids || [])));
    const [members, gyms, users, claims] = await Promise.all([
      memberIds.length ? db.from("bgm_members")
        .select("id,member_number,full_name,legacy_pk_customer,status,membership_expiry,enrollment_gym_id,official_photo_path,updated_at")
        .in("id", memberIds) : Promise.resolve({ data: [], error: null }),
      db.from("bgm_gyms").select("id,name"),
      db.from("bgm_system_users").select("id,display_name"),
      memberIds.length ? db.from("bgm_legacy_card_claims")
        .select("member_id,scan3,updated_at").in("member_id", memberIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [members, gyms, users, claims]) if (result.error) throw result.error;
    const byId = new Map((members.data || []).map((m) => [m.id, m]));
    const gymNames = new Map((gyms.data || []).map((g) => [g.id, g.name]));
    const userNames = new Map((users.data || []).map((u) => [u.id, u.display_name]));
    const reviewByScan = new Map((reviews.data || []).map((r) => [r.scan3, r]));
    return NextResponse.json({
      conflicts: (conflicts.data || []).map((group) => {
        const review = reviewByScan.get(group.scan3);
        return {
          scan3: group.scan3, reviewId: review?.id || null,
          flaggedAt: review?.requested_at || null,
          flaggedGym: gymNames.get(review?.gym_id || "") || null,
          flaggedBy: userNames.get(review?.requested_by_system_user_id || "") || null,
          members: (group.member_ids || []).map((id: string) => {
            const m = byId.get(id);
            return m && {
              id: m.id, memberNumber: m.member_number, fullName: m.full_name,
              legacyPkCustomer: m.legacy_pk_customer, status: m.status,
              membershipExpiry: m.membership_expiry, enrollmentGymName:
                gymNames.get(m.enrollment_gym_id || "") || "Not recorded",
              photoUrl: m.official_photo_path
                ? `/api/system/members/photo/${encodeURIComponent(m.id)}?inline=1` : null,
              updatedAt: (claims.data || []).find((c) =>
                c.member_id === id && c.scan3 === group.scan3)?.updated_at,
            };
          }).filter(Boolean),
        };
      }),
      flaggedWithoutActiveConflict: (reviews.data || []).filter((r) =>
        !(conflicts.data || []).some((c) => c.scan3 === r.scan3)).map((r) => ({
          id: r.id, scan3: r.scan3, flaggedAt: r.requested_at,
        })),
    }, { headers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load card conflicts." }, { status: 500, headers });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.scan3 !== "string" ||
        !body.scan3.trim() || !["remove_card", "change_card", "resolve"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid conflict action." }, { status: 400, headers });
    }
    const db = getSupabaseAdmin();
    if (body.action === "resolve") {
      if (typeof body.reviewId !== "string" || typeof body.note !== "string" || !body.note.trim())
        return NextResponse.json({ error: "Review and resolution note required." }, { status: 400, headers });
      const stillConflicted = await db.from("bgm_active_card_conflicts")
        .select("scan3").eq("scan3", body.scan3).maybeSingle();
      if (stillConflicted.error) throw stillConflicted.error;
      if (stillConflicted.data) return NextResponse.json({
        error: "The card still matches multiple active members. Change or remove a card assignment first.",
      }, { status: 409, headers });
      const updated = await db.from("bgm_card_conflict_reviews").update({
        status: "resolved", resolved_by_system_user_id: auth.context.systemUserId,
        resolved_at: new Date().toISOString(), resolution_note: body.note.trim(),
      }).eq("id", body.reviewId).eq("scan3", body.scan3).eq("status", "unresolved")
        .select("id").maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) return NextResponse.json({ error: "Open review not found." }, { status: 404, headers });
      return NextResponse.json({ resolved: true }, { headers });
    }
    if (typeof body.memberId !== "string" || typeof body.expectedUpdatedAt !== "string" ||
        (body.action === "change_card" && (typeof body.newScan3 !== "string" || !body.newScan3.trim()))) {
      return NextResponse.json({ error: "Member, card and version required." }, { status: 400, headers });
    }
    const changed = await db.rpc("bgm_super_admin_change_legacy_card", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: body.memberId,
      p_current_scan3: body.scan3,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_action: body.action,
      p_new_scan3: body.action === "change_card" ? body.newScan3.trim() : null,
      p_reason: typeof body.reason === "string" ? body.reason.trim() : "Card Conflict Review",
    });
    if (changed.error) {
      const detail = String(changed.error.message || "");
      if (/changed|already assigned|Invalid card/.test(detail))
        return NextResponse.json({ error: detail }, { status: 409, headers });
      throw changed.error;
    }
    return NextResponse.json(changed.data, { headers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update card conflict." }, { status: 500, headers });
  }
}
