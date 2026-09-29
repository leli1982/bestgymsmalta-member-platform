import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isMemberUuid } from "@/lib/memberCancellationCore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const { memberId } = await params;
    if (!isMemberUuid(memberId))
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400, headers: noStore });
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "action,expectedUpdatedAt,reason"
      || !["archive", "restore"].includes(body.action)
      || typeof body.expectedUpdatedAt !== "string"
      || !Number.isFinite(Date.parse(body.expectedUpdatedAt))
      || typeof body.reason !== "string" || body.reason.length > 500
      || (body.action === "archive" && !body.reason.trim())) {
      return NextResponse.json({ error: "Invalid account-status request. Add an archive reason and reload the member." },
        { status: 400, headers: noStore });
    }
    const result = await getSupabaseAdmin().rpc("bgm_super_admin_member_archive_restore", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_action: body.action,
      p_reason: body.reason.trim(),
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/Super Admin access required/.test(message))
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403, headers: noStore });
      if (/Member not found/.test(message))
        return NextResponse.json({ error: "Member not found." }, { status: 404, headers: noStore });
      if (/changed|Reload/.test(message))
        return NextResponse.json({ error: "The record changed. Reload the member before retrying." }, { status: 409, headers: noStore });
      if (/already archived|Only archived|Shared active couples membership|Invalid member archive/.test(message))
        return NextResponse.json({ error: message }, { status: 400, headers: noStore });
      console.error(result.error);
      return NextResponse.json({ error: "No account-status change was confirmed." }, { status: 500, headers: noStore });
    }
    return NextResponse.json({ ok: true, ...result.data }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update member account status." }, { status: 500, headers: noStore });
  }
}
