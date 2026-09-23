import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { validateCancellationCommand } from "@/lib/memberCancellationCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!UUID.test(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    const validation = validateCancellationCommand(await request.json());
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

    const result = await getSupabaseAdmin().rpc("bgm_super_admin_member_cancellation", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_member_updated_at: validation.expectedMemberUpdatedAt,
      p_membership_id: validation.membershipId,
      p_expected_membership_updated_at: validation.expectedMembershipUpdatedAt,
      p_action: validation.action,
      p_effective_date: validation.effectiveDate,
      p_reason: validation.reason,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/changed elsewhere|changed\. Reload|ambiguous|Reload before|Current linked membership changed/i.test(message)) {
        return NextResponse.json({ error: "This membership changed. Reload before changing cancellation." }, { status: 409 });
      }
      if (/Super Admin access required/i.test(message)) {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      }
      if (/Member not found/i.test(message)) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (/Shared couples membership|effective date|active unexpired|Cancellation already took effect|pending cancellation|new membership renewal|Invalid cancellation/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(result.error);
      return NextResponse.json({ error: "Cancellation was not confirmed. Reload before retrying." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      changed: result.data?.changed === true,
      effectiveDate: result.data?.effectiveDate || null,
      updatedAt: result.data?.updatedAt || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not process membership cancellation." }, { status: 500 });
  }
}
