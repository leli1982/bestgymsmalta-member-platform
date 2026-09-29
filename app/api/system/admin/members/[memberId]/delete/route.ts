import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isMemberUuid } from "@/lib/memberCancellationCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!isMemberUuid(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400, headers: noStore });
    const result = await getSupabaseAdmin().rpc("bgm_super_admin_member_delete_assessment", {
      p_system_user_id: auth.context.systemUserId, p_member_id: memberId,
    });
    if (result.error) {
      if (/Member not found/.test(result.error.message || ""))
        return NextResponse.json({ error: "Member not found." }, { status: 404, headers: noStore });
      console.error(result.error);
      return NextResponse.json({ error: "Could not check permanent-deletion eligibility." }, { status: 500, headers: noStore });
    }
    return NextResponse.json({ assessment: result.data }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not check permanent-deletion eligibility." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!isMemberUuid(memberId)) return NextResponse.json({ error: "Invalid member ID." }, { status: 400, headers: noStore });
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "confirmedMemberNumber,expectedUpdatedAt"
      || typeof body.confirmedMemberNumber !== "string" || !/^BGM[0-9]{7}$/.test(body.confirmedMemberNumber)
      || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      return NextResponse.json({ error: "Type the member's exact BGM number and reload before deleting." },
        { status: 400, headers: noStore });
    }
    const result = await getSupabaseAdmin().rpc("bgm_super_admin_member_delete", {
      p_system_user_id: auth.context.systemUserId, p_member_id: memberId,
      p_expected_updated_at: body.expectedUpdatedAt, p_confirmed_member_number: body.confirmedMemberNumber,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/Super Admin access required/.test(message))
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403, headers: noStore });
      if (/Member not found/.test(message))
        return NextResponse.json({ error: "Member not found." }, { status: 404, headers: noStore });
      if (/changed|Reload|mismatched/.test(message))
        return NextResponse.json({ error: "Member details changed or the confirmation did not match. Reload." },
          { status: 409, headers: noStore });
      if (/blocked by linked or retained records/.test(message))
        return NextResponse.json({ error: message }, { status: 409, headers: noStore });
      console.error(result.error);
      return NextResponse.json({ error: "Permanent deletion was not confirmed." }, { status: 500, headers: noStore });
    }
    return NextResponse.json({ ok: result.data?.deleted === true, deleted: result.data?.deleted === true },
      { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Permanent deletion was not confirmed." }, { status: 500, headers: noStore });
  }
}
