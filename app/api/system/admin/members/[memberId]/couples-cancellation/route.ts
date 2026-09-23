import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validateCouplesCancellationCommand } from "@/lib/memberCancellationCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const validation = validateCouplesCancellationCommand(await request.json());
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    if (validation.partnerId === memberId)
      return NextResponse.json({ error: "A couples membership requires two distinct people." }, { status: 400 });
    const result = await getSupabaseAdmin().rpc("bgm_super_admin_couples_cancellation", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_partner_id: validation.partnerId,
      p_membership_id: validation.membershipId,
      p_expected_member_updated_at: validation.expectedMemberUpdatedAt,
      p_expected_partner_updated_at: validation.expectedPartnerUpdatedAt,
      p_expected_membership_updated_at: validation.expectedMembershipUpdatedAt,
      p_action: validation.action,
      p_effective_date: validation.effectiveDate,
      p_reason: validation.reason,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/Super Admin access required/i.test(message))
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      if (/not found/i.test(message))
        return NextResponse.json({ error: "A member or the shared membership was not found." }, { status: 404 });
      if (/changed|reload|ambiguous|inconsistent|relationship|linked|stale/i.test(message))
        return NextResponse.json({ error: message }, { status: 409 });
      if (/couples|effective date|active|unexpired|pending|Invalid/i.test(message))
        return NextResponse.json({ error: message }, { status: 400 });
      console.error(result.error);
      return NextResponse.json({ error: "Joint cancellation was not confirmed. Neither partner should be assumed changed." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true, changed: result.data?.changed === true,
      effectiveDate: result.data?.effectiveDate || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not process joint cancellation." }, { status: 500 });
  }
}
