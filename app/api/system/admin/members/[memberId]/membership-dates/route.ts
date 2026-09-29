import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateMembershipDateEdit } from "@/lib/memberDateEditCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!UUID.test(memberId)) {
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    }
    const validation = validateMembershipDateEdit(await request.json());
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const db = getSupabaseAdmin();
    const result = await db.rpc("bgm_super_admin_correct_member_dates", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_member_updated_at: validation.expectedMemberUpdatedAt,
      p_membership_id: validation.membershipId,
      p_expected_membership_updated_at: validation.expectedMembershipUpdatedAt,
      p_start_date: validation.startDate,
      p_expiry_date: validation.expiryDate,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/changed elsewhere|reload before correcting|current membership is ambiguous|has no linked membership/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      if (/Super Admin access required/i.test(message)) {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      }
      if (/Member not found/i.test(message)) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (/shared membership|both members together|specific current membership|does not belong|cancelled|expiry date|start date/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(result.error);
      return NextResponse.json({ error: "Could not correct membership dates. No update was confirmed." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      changed: result.data?.changed === true,
      updatedAt: result.data?.updatedAt || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not correct membership dates." }, { status: 500 });
  }
}
