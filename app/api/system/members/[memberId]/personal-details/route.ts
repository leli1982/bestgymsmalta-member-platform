import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";
import { STAFF_PERSONAL_DETAIL_FIELDS, validateStaffPersonalDetails } from "@/lib/staffMemberPersonalDetailsCore";
import { bestEffortSyncGoogleWalletMembers } from "@/lib/googleWalletSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const COLS = "id,member_number,full_name,first_name,last_name,id_number,address_line_1,address_line_2,town,postcode,country,mobile,phone,telephone_no_1,telephone_no_2,email,next_of_kin,updated_at,archived_at,official_photo_path";

export async function GET(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSystemPermission(request, "members.edit");
    if (auth.error || !auth.context) return auth.error;
    if (auth.context.isSuperAdmin) {
      return NextResponse.json({ error: "Use the Super Admin member editor." }, { status: 403 });
    }
    const { memberId } = await params;
    if (!UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const db = getSupabaseAdmin();
    const memberResult = await db.from("bgm_members").select(COLS).eq("id", memberId).maybeSingle();
    if (memberResult.error) throw memberResult.error;
    const member = memberResult.data;
    if (!member || member.archived_at) {
      return NextResponse.json({ error: "Member not available for staff editing." }, { status: 404, headers: noStore });
    }
    const profile = {
      firstName: member.first_name || "", lastName: member.last_name || "",
      idNumber: member.id_number || "",
      addressLine1: member.address_line_1 || "", addressLine2: member.address_line_2 || "",
      town: member.town || "", postcode: member.postcode || "", country: member.country || "",
      mobile: member.mobile || "", phone: member.phone || "",
      telephoneNo1: member.telephone_no_1 || "", telephoneNo2: member.telephone_no_2 || "",
      email: member.email || "", nextOfKin: member.next_of_kin || "",
    };
    // Sanity check: response and PATCH share the exact restricted allowlist.
    if (Object.keys(profile).length !== STAFF_PERSONAL_DETAIL_FIELDS.length) {
      throw new Error("Staff profile fields are inconsistent.");
    }
    return NextResponse.json({
      member: { id: member.id, memberNumber: member.member_number, fullName: member.full_name,
        updatedAt: member.updated_at, photoUrl: member.official_photo_path ? `/api/system/members/photo/${member.id}?inline=1&v=${encodeURIComponent(member.updated_at)}` : null, profile },
    }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load personal details." }, { status: 500, headers: noStore });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSystemPermission(request, "members.edit");
    if (auth.error || !auth.context) return auth.error;
    if (auth.context.isSuperAdmin) {
      return NextResponse.json({ error: "Use the Super Admin member editor." }, { status: 403 });
    }
    const { memberId } = await params;
    if (!UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).sort().join(",") !== "expectedUpdatedAt,profile") {
      return NextResponse.json({ error: "Only approved personal-detail updates may be submitted." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const expectedUpdatedAt = payload.expectedUpdatedAt;
    if (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return NextResponse.json({ error: "Reload the member before saving." }, { status: 400 });
    }
    const validated = validateStaffPersonalDetails(payload.profile);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

    const result = await getSupabaseAdmin().rpc("bgm_staff_update_member_personal_details", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_updated_at: expectedUpdatedAt,
      p_profile: validated.profile,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/changed elsewhere|reload.*before saving/i.test(message)) {
        return NextResponse.json({ error: "Member details were changed elsewhere. Reload before saving." }, { status: 409 });
      }
      if (/staff access required/i.test(message)) {
        return NextResponse.json({ error: "This staff account is not authorised to edit personal details." }, { status: 403 });
      }
      if (/cannot be edited here|only approved|valid email|first name and surname|field exceeds/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(result.error);
      return NextResponse.json({ error: "Could not save member details. No changes confirmed." }, { status: 500 });
    }
    await bestEffortSyncGoogleWalletMembers([memberId]).catch(() => undefined);
    return NextResponse.json({ ok: true, updatedAt: result.data?.updatedAt || null }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save member details." }, { status: 500, headers: noStore });
  }
}
