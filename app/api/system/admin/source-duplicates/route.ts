import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import {
  SOURCE_DUPLICATE_SNAPSHOT, sourceDuplicateGroups, sourceReviewTotals,
  normalizeLegacyPk,
} from "@/lib/sourceDuplicateReviewScope";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const scope = new Set(sourceDuplicateGroups.map((g) => g.pk));

type LiveMember = {
  id: string; member_number: string; full_name: string;
  legacy_pk_customer: string | null; status: string;
  membership_expiry: string | null; enrollment_gym_id: string | null;
  official_photo_path: string | null; updated_at: string;
  real_import_batch_id: string | null; archived_at: string | null;
  id_number: string | null; date_of_birth: string | null; email: string | null;
};

function normalizedIdentity(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hasLiveIdentityConflict(members: LiveMember[]) {
  if (members.some((m) => !m.real_import_batch_id)) return true; // Protect every app-created record.
  if (members.length < 2) return false;
  const reference = members[0];
  return members.slice(1).some((m) =>
    normalizedIdentity(m.full_name) !== normalizedIdentity(reference.full_name)
    || Boolean(m.date_of_birth && reference.date_of_birth && m.date_of_birth !== reference.date_of_birth)
    || Boolean(m.id_number && reference.id_number &&
      m.id_number.replace(/[^a-z0-9]/gi, "").toLowerCase() !== reference.id_number.replace(/[^a-z0-9]/gi, "").toLowerCase())
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    // The source scope contains no personal details; member data is retrieved from
    // production only by authenticated Super Admin, never embedded in the repository.
    const pkVariants = Array.from(new Set(sourceDuplicateGroups.flatMap((g) =>
      [g.pk, g.pk.toUpperCase()]
    )));
    const [membersResult, decisionsResult] = await Promise.all([
      db.from("bgm_members")
        .select("id,member_number,full_name,legacy_pk_customer,status,membership_expiry,enrollment_gym_id,official_photo_path,updated_at,real_import_batch_id,archived_at,id_number,date_of_birth,email")
        .in("legacy_pk_customer", pkVariants).range(0, 999),
      db.from("bgm_source_duplicate_review_decisions")
        .select("legacy_pk_customer,status,resolution_note,reviewed_at,updated_at"),
    ]);
    if (membersResult.error) throw membersResult.error;
    if (decisionsResult.error) throw decisionsResult.error;
    if ((membersResult.data || []).length === 1000) {
      throw new Error("The duplicate lookup reached its safety limit; pagination is required.");
    }
    const byPk = new Map<string, LiveMember[]>();
    for (const member of (membersResult.data || []) as LiveMember[]) {
      const key = normalizeLegacyPk(member.legacy_pk_customer);
      const group = byPk.get(key) || [];
      group.push(member);
      byPk.set(key, group);
    }
    const decisions = new Map((decisionsResult.data || []).map((item) =>
      [normalizeLegacyPk(item.legacy_pk_customer), item]
    ));
    const groups = sourceDuplicateGroups.map((source) => {
      const liveMembers = (byPk.get(source.pk) || []).sort((a,b) =>
        a.member_number.localeCompare(b.member_number)
      );
      const decision = decisions.get(source.pk);
      const liveIdentityConflict = hasLiveIdentityConflict(liveMembers);
      const isPreclassified = source.assessment === "same_person_candidate" && !liveIdentityConflict;
      const state = decision?.status === "reviewed" ? "reviewed"
        : decision?.status === "pending" ? "pending"
        : isPreclassified ? "preclassified" : "pending";
      return {
        legacyPkCustomer: source.pk.toUpperCase(),
        sourceCount: source.sourceCount, sourceKind: source.sourceKind,
        assessment: source.assessment,
        state, liveIdentityConflict,
        reviewNote: decision?.resolution_note || null,
        reviewedAt: decision?.reviewed_at || null,
        members: liveMembers.map((m) => ({
          id: m.id, memberNumber: m.member_number, fullName: m.full_name,
          status: m.status, membershipExpiry: m.membership_expiry,
          enrollmentGymId: m.enrollment_gym_id,
          photoUrl: m.official_photo_path
            ? `/api/system/members/photo/${encodeURIComponent(m.id)}?inline=1` : null,
          appCreated: !m.real_import_batch_id,
          archived: Boolean(m.archived_at),
          dateOfBirth: m.date_of_birth,
          email: m.email,
          updatedAt: m.updated_at,
        })),
      };
    });
    return NextResponse.json({
      source: SOURCE_DUPLICATE_SNAPSHOT,
      sourceTotals: sourceReviewTotals,
      summary: {
        pending: groups.filter((g) => g.state === "pending").length,
        preclassified: groups.filter((g) => g.state === "preclassified").length,
        reviewed: groups.filter((g) => g.state === "reviewed").length,
      },
      groups,
    }, { headers });
  } catch (error) {
    console.error("Source duplicate review GET failed", error);
    return NextResponse.json({
      error: "Could not load duplicate review. No membership records were changed."
    }, { status: 500, headers });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => null);
    const pk = normalizeLegacyPk(body?.legacyPkCustomer);
    const action = body?.action;
    const note = String(body?.note || "").trim();
    if (!scope.has(pk) || !["mark_reviewed", "reopen"].includes(action)
      || (action === "mark_reviewed" && note.length < 8)
      || note.length > 2000) {
      return NextResponse.json({ error: "Valid review, action and a meaningful note required." },
        { status: 400, headers });
    }
    const db = getSupabaseAdmin();
    const before = await db.from("bgm_source_duplicate_review_decisions")
      .select("status,resolution_note,reviewed_at").eq("legacy_pk_customer", pk).maybeSingle();
    if (before.error) throw before.error;
    const updated = {
      legacy_pk_customer: pk,
      status: action === "mark_reviewed" ? "reviewed" : "pending",
      resolution_note: note,
      reviewed_by_system_user_id: action === "mark_reviewed" ? auth.context.systemUserId : null,
      reviewed_at: action === "mark_reviewed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const saved = await db.from("bgm_source_duplicate_review_decisions")
      .upsert(updated, { onConflict: "legacy_pk_customer" }).select("legacy_pk_customer").single();
    if (saved.error) throw saved.error;
    const audit = await db.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      action_key: action === "mark_reviewed" ? "legacy_duplicate.reviewed" : "legacy_duplicate.reopened",
      entity_type: "legacy_duplicate_review",
      entity_id: pk,
      before_data: before.data || null,
      after_data: {
        source: SOURCE_DUPLICATE_SNAPSHOT,
        status: updated.status, resolution_note: updated.resolution_note,
        reviewed_at: updated.reviewed_at,
        member_mutation: false,
      },
    });
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true, legacyPkCustomer: pk, status: updated.status }, { headers });
  } catch (error) {
    console.error("Source duplicate review PATCH failed", error);
    return NextResponse.json({ error: "Could not save review decision. Please refresh its status." },
      { status: 500, headers });
  }
}
