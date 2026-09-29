import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateMemberProfile } from "@/lib/superAdminMemberProfileCore";
import { resolveMemberDateEdit } from "@/lib/memberDateEditCore";
import { resolveMemberCancellation, resolveCouplesCancellation } from "@/lib/memberCancellationCore";
import { todayMaltaDate } from "@/lib/maltaDate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MEMBER_COLUMNS = "id, member_number, first_name, last_name, full_name, email, mobile, id_number, date_of_birth, address_line_1, address_line_2, town, postcode, next_of_kin, status, membership_expiry, enrollment_date, membership_period, enrollment_gym_id, legacy_gym, legacy_pk_customer, official_photo_path, cancellation_effective_date, cancellation_reason, cancellation_recorded_at, archived_at, archived_reason, updated_at";

const MEMBER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!MEMBER_UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const db = getSupabaseAdmin();
    const [memberResult, gymResult, linksResult, cardsResult] = await Promise.all([
      db.from("bgm_members").select(MEMBER_COLUMNS).eq("id", memberId).maybeSingle(),
      db.from("bgm_gyms").select("id,name,status").order("name", { ascending: true }),
      db.from("bgm_membership_members").select("membership_id,member_role").eq("member_id", memberId),
      db.from("bgm_member_card_credentials").select("barcode_value,status,updated_at").eq("member_id", memberId).eq("status", "active").order("updated_at", { ascending: false }),
    ]);
    for (const result of [memberResult, gymResult, linksResult, cardsResult]) {
      if (result.error) throw result.error;
    }
    const member = memberResult.data;
    if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404, headers: noStore });

    const linkRows = linksResult.data || [];
    const membershipIds = linkRows.map((link) => link.membership_id);
    const membershipsResult = membershipIds.length
      ? await db.from("bgm_memberships")
        .select("id,application_id,membership_type,duration_key,start_date,expiry_date,enrollment_gym_id,status,cancellation_effective_date,created_at,updated_at")
        .in("id", membershipIds).order("created_at", { ascending: false })
      : { data: [], error: null };
    if (membershipsResult.error) throw membershipsResult.error;
    const membershipRows = membershipsResult.data || [];
    const participantsResult = membershipIds.length
      ? await db.from("bgm_membership_members").select("membership_id,member_id,member_role").in("membership_id", membershipIds)
      : { data: [], error: null };
    if (participantsResult.error) throw participantsResult.error;
    const participantCounts = new Map<string, number>();
    for (const row of participantsResult.data || []) {
      participantCounts.set(row.membership_id, (participantCounts.get(row.membership_id) || 0) + 1);
    }
    const dateEdit = resolveMemberDateEdit(
      member.membership_expiry,
      member.enrollment_date,
      membershipRows.map((row) => ({
        id: row.id,
        status: row.status,
        start_date: row.start_date,
        expiry_date: row.expiry_date,
        updated_at: row.updated_at,
        participantCount: participantCounts.get(row.id) || 0,
      }))
    );
    const cancellationEdit = resolveMemberCancellation({
      memberStatus: member.status,
      membershipExpiry: member.membership_expiry,
      cancellationEffectiveDate: member.cancellation_effective_date,
      today: todayMaltaDate(),
      memberships: membershipRows.map((row) => ({
        id: row.id, status: row.status, expiry_date: row.expiry_date,
        updated_at: row.updated_at, participantCount: participantCounts.get(row.id) || 0,
      })),
    });
    // A joint editor is exposed only after both identities and the single current
    // couples contract are resolved. The SQL action independently revalidates all
    // relationships and version tokens under row locks.
    let couplesCancellationEdit = null;
    const currentCouples = membershipRows.filter((row) =>
      row.membership_type === "couples" && row.status === "active"
      && row.expiry_date === member.membership_expiry
      && participantCounts.get(row.id) === 2);
    if (currentCouples.length === 1) {
      const contract = currentCouples[0];
      const people = (participantsResult.data || []).filter((row) => row.membership_id === contract.id);
      const partnerLink = people.find((row) => row.member_id !== member.id);
      if (partnerLink && people.length === 2 && people.some((row) => row.member_id === member.id)
        && new Set(people.map((row) => row.member_id)).size === 2) {
        const [partnerResult, partnerLinksResult] = await Promise.all([
          db.from("bgm_members")
            .select("id,full_name,member_number,status,membership_expiry,cancellation_effective_date,updated_at")
            .eq("id", partnerLink.member_id).maybeSingle(),
          db.from("bgm_membership_members").select("membership_id").eq("member_id", partnerLink.member_id),
        ]);
        if (partnerResult.error) throw partnerResult.error;
        if (partnerLinksResult.error) throw partnerLinksResult.error;
        const partner = partnerResult.data;
        const partnerIds = (partnerLinksResult.data || []).map((row) => row.membership_id);
        const partnerMemberships = partnerIds.length
          ? await db.from("bgm_memberships").select("id,status,expiry_date").in("id", partnerIds)
          : { data: [], error: null };
        if (partnerMemberships.error) throw partnerMemberships.error;
        if (partner) {
          const resolution = resolveCouplesCancellation({
            memberStatus: member.status, partnerStatus: partner.status,
            memberExpiry: member.membership_expiry, partnerExpiry: partner.membership_expiry,
            membershipExpiry: contract.expiry_date, membershipStatus: contract.status,
            memberEffectiveDate: member.cancellation_effective_date,
            partnerEffectiveDate: partner.cancellation_effective_date,
            membershipEffectiveDate: contract.cancellation_effective_date,
            today: todayMaltaDate(),
            memberCurrentMatches: membershipRows.filter((row) =>
              row.status !== "cancelled" && row.expiry_date === member.membership_expiry).length,
            partnerCurrentMatches: (partnerMemberships.data || []).filter((row) =>
              row.status !== "cancelled" && row.expiry_date === partner.membership_expiry).length,
          });
          couplesCancellationEdit = {
            ...resolution, membershipId: contract.id,
            expectedMembershipUpdatedAt: contract.updated_at,
            effectiveDate: contract.cancellation_effective_date,
            today: todayMaltaDate(), expiryDate: contract.expiry_date,
            partner: { id: partner.id, fullName: partner.full_name || "Member name not recorded",
              memberNumber: partner.member_number, updatedAt: partner.updated_at },
          };
        }
      }
    }
    const applicationIds = membershipRows.map((row) => row.application_id).filter((id): id is string => Boolean(id));
    const applicationsResult = applicationIds.length
      ? await db.from("bgm_membership_applications")
        .select("id,application_reference,base_price_cents,discount_amount_cents,final_amount_cents,currency,payment_method,payment_other_text,payment_received_at,activated_at")
        .in("id", applicationIds)
      : { data: [], error: null };
    if (applicationsResult.error) throw applicationsResult.error;
    const applications = new Map((applicationsResult.data || []).map((row) => [row.id, row]));
    const roles = new Map(linkRows.map((row) => [row.membership_id, row.member_role]));

    return NextResponse.json({
      member: {
        id: member.id,
        memberNumber: member.member_number,
        firstName: member.first_name || "",
        lastName: member.last_name || "",
        fullName: member.full_name || "",
        email: member.email || "",
        mobile: member.mobile || "",
        dateOfBirth: member.date_of_birth || "",
        idNumber: member.id_number || "",
        addressLine1: member.address_line_1 || "",
        addressLine2: member.address_line_2 || "",
        town: member.town || "",
        postcode: member.postcode || "",
        nextOfKin: member.next_of_kin || "",
        status: member.status,
        membershipExpiry: member.membership_expiry || null,
        cancellationEffectiveDate: member.cancellation_effective_date || null,
        cancellationReason: member.cancellation_reason || "",
        cancellationRecordedAt: member.cancellation_recorded_at || null,
        archivedAt: member.archived_at || null,
        archivedReason: member.archived_reason || null,
        enrollmentDate: member.enrollment_date || null,
        membershipPeriod: member.membership_period || null,
        enrollmentGymId: member.enrollment_gym_id || null,
        originalEnrollmentGym: member.legacy_gym || null,
        legacyPkCustomer: member.legacy_pk_customer || null,
        photoUrl: member.official_photo_path ? `/api/system/members/photo/${encodeURIComponent(member.id)}` : null,
        updatedAt: member.updated_at,
      },
      activeCardNumber: cardsResult.data?.[0]?.barcode_value || null,
      dateEdit,
      cancellationEdit: { ...cancellationEdit, today: todayMaltaDate() },
      couplesCancellationEdit,
      gyms: gymResult.data || [],
      memberships: membershipRows.map((row) => ({
        id: row.id,
        role: roles.get(row.id) || "primary",
        membershipType: row.membership_type,
        duration: row.duration_key,
        startDate: row.start_date,
        expiryDate: row.expiry_date,
        enrollmentGymId: row.enrollment_gym_id,
        status: row.status,
        participantCount: participantCounts.get(row.id) || 0,
        createdAt: row.created_at,
        application: row.application_id ? applications.get(row.application_id) || null : null,
      })),
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load member details." }, { status: 500, headers: noStore });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!MEMBER_UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "expectedUpdatedAt,profile") {
      return NextResponse.json({ error: "Only personal profile edits are supported here." }, { status: 400 });
    }
    if (typeof body.expectedUpdatedAt !== "string"
      || !body.expectedUpdatedAt || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      return NextResponse.json({ error: "Reload this member before saving changes." }, { status: 400 });
    }
    const validation = validateMemberProfile(body.profile);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const db = getSupabaseAdmin();
    const result = await db.rpc("bgm_super_admin_update_member_profile", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_profile: validation.profile,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/changed since you opened|reload before saving/i.test(message)) {
        return NextResponse.json({ error: "Member details were changed elsewhere. Reload before saving." }, { status: 409 });
      }
      if (/Super Admin access required/i.test(message)) {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      }
      if (/Member not found/i.test(message)) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (/Invalid member profile fields|valid email|date of birth|too long|first and last name/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(result.error);
      return NextResponse.json({ error: "Could not save member details. No change was confirmed." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updatedAt: result.data?.updatedAt || null }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save member details." }, { status: 500 });
  }
}
