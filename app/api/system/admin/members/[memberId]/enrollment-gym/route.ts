import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const gymIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { memberId } = await params;
    if (!uuid.test(memberId)) {
      return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
    }
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "enrollmentGymId,expectedUpdatedAt"
      || typeof body.enrollmentGymId !== "string" || !gymIdPattern.test(body.enrollmentGymId)
      || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      return NextResponse.json({ error: "Select a valid gym and reload the member before saving." }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const changeResult = await db.rpc("bgm_super_admin_change_member_enrollment_gym", {
      p_system_user_id: auth.context.systemUserId,
      p_member_id: memberId,
      p_expected_updated_at: body.expectedUpdatedAt,
      p_new_gym_id: body.enrollmentGymId,
    });

    if (changeResult.error) {
      const message = String(changeResult.error.message || "");
      if (/changed elsewhere|reload before changing/i.test(message)) {
        return NextResponse.json({ error: "Member details changed elsewhere. Reload before saving." }, { status: 409 });
      }
      if (/Super Admin access required/i.test(message)) {
        return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
      }
      if (/Member not found/i.test(message)) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (/Select an active|not active|Reload the member/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      console.error(changeResult.error);
      return NextResponse.json({ error: "Could not change the enrollment gym. No update was confirmed." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      changed: changeResult.data?.changed === true,
      updatedAt: changeResult.data?.updatedAt || null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not change the enrollment gym." }, { status: 500 });
  }
}
