import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSystemPermission } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

const NEPTUNES_GYM_ID = "bgm-neptunes";
const VALID_SCOPES = new Set(["network", "neptunes_only"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const auth = await requireSystemPermission(request, "members.create");
    if (auth.error || !auth.context) return auth.error;

    const { applicationId } = await params;
    const body = await request.json();
    const accessScope = clean(body.accessScope).toLowerCase();
    if (!VALID_SCOPES.has(accessScope)) {
      return NextResponse.json({ error: "Select Network or Neptunes Only access." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const applicationResult = await supabase
      .from("bgm_membership_applications")
      .select("id,application_kind,enrollment_gym_id,status,access_scope")
      .eq("id", applicationId)
      .maybeSingle();
    if (applicationResult.error) throw applicationResult.error;
    const application = applicationResult.data;
    if (!application) {
      return NextResponse.json({ error: "Membership application not found." }, { status: 404 });
    }
    if (application.application_kind !== "new") {
      return NextResponse.json({ error: "Renewals preserve the existing member access scope." }, { status: 409 });
    }
    if (!["submitted", "awaiting_payment"].includes(application.status)) {
      return NextResponse.json({ error: "Access scope can only be changed before activation." }, { status: 409 });
    }
    if (!auth.context.isSuperAdmin && auth.context.gymId !== application.enrollment_gym_id) {
      return NextResponse.json({ error: "This application belongs to another gym." }, { status: 403 });
    }
    if (accessScope === "neptunes_only" && application.enrollment_gym_id !== NEPTUNES_GYM_ID) {
      return NextResponse.json({ error: "Neptunes Only access can only be assigned at Neptunes Fitness." }, { status: 409 });
    }

    const updateResult = await supabase
      .from("bgm_membership_applications")
      .update({ access_scope: accessScope, updated_at: new Date().toISOString() })
      .eq("id", application.id)
      .select("id,access_scope")
      .single();
    if (updateResult.error) throw updateResult.error;

    await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: application.enrollment_gym_id,
      staff_name: auth.context.displayName,
      action_key: "membership.access_scope.updated",
      entity_type: "membership_application",
      entity_id: application.id,
      before_data: { accessScope: application.access_scope || "network" },
      after_data: { accessScope },
    });

    return NextResponse.json({ ok: true, accessScope });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update membership access scope." }, { status: 500 });
  }
}
