import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ terminalId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { terminalId } = await context.params;
    const body = await request.json().catch(() => null);
    const supabase = getSupabaseAdmin();
    const currentResult = await supabase
      .from("bgm_staff_terminals")
      .select("id, gym_id, name, active")
      .eq("id", terminalId)
      .maybeSingle();
    if (currentResult.error) throw currentResult.error;
    if (!currentResult.data) {
      return NextResponse.json({ error: "Punch Clock terminal not found." }, { status: 404 });
    }

    const current = currentResult.data;
    const name = body?.name === undefined ? current.name : clean(body.name);
    const gymId = body?.gymId === undefined ? current.gym_id : clean(body.gymId);
    const active = body?.active === undefined ? current.active : Boolean(body.active);
    if (!name || !gymId) {
      return NextResponse.json({ error: "Terminal name and gym are required." }, { status: 400 });
    }

    if (gymId !== current.gym_id) {
      const gymResult = await supabase.from("bgm_gyms").select("id").eq("id", gymId).maybeSingle();
      if (gymResult.error) throw gymResult.error;
      if (!gymResult.data) return NextResponse.json({ error: "Gym not found." }, { status: 400 });
    }

    const update = await supabase
      .from("bgm_staff_terminals")
      .update({ gym_id: gymId, name, active, updated_at: new Date().toISOString() })
      .eq("id", terminalId)
      .select("id, gym_id, name, active, last_seen_at, created_at, updated_at")
      .single();
    if (update.error) throw update.error;

    const auditRows = [
      {
        system_user_id: auth.context.systemUserId,
        context_gym_id: gymId,
        action_key: "staff.terminal.updated",
        entity_type: "staff_terminal",
        entity_id: terminalId,
        before_data: { gymId: current.gym_id, name: current.name, active: current.active },
        after_data: { gymId, name, active },
      },
    ];
    if (active !== current.active) {
      auditRows.push({
        system_user_id: auth.context.systemUserId,
        context_gym_id: gymId,
        action_key: "staff.terminal.status_changed",
        entity_type: "staff_terminal",
        entity_id: terminalId,
        before_data: { gymId: current.gym_id, name: current.name, active: current.active },
        after_data: { gymId, name, active },
      });
    }
    const audit = await supabase.from("bgm_audit_log").insert(auditRows);
    if (audit.error) throw audit.error;

    return NextResponse.json({
      terminal: {
        id: update.data.id,
        gymId: update.data.gym_id,
        name: update.data.name,
        active: update.data.active,
        lastSeenAt: update.data.last_seen_at,
        createdAt: update.data.created_at,
        updatedAt: update.data.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update Punch Clock terminal." }, { status: 500 });
  }
}
