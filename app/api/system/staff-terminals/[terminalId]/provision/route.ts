import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import {
  createTerminalSecret,
  hashTerminalSecret,
  terminalCookieName,
} from "@/lib/staffTerminalAuth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ terminalId: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const { terminalId } = await context.params;
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

    const secret = createTerminalSecret();
    const credentialHash = hashTerminalSecret(secret);
    const now = new Date().toISOString();
    const update = await supabase
      .from("bgm_staff_terminals")
      .update({ credential_hash: credentialHash, updated_at: now })
      .eq("id", terminalId)
      .select("id, gym_id, name, active")
      .single();
    if (update.error) throw update.error;

    const audit = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: update.data.gym_id,
      action_key: "staff.terminal.credential_rotated",
      entity_type: "staff_terminal",
      entity_id: update.data.id,
      before_data: { credentialRotated: false },
      after_data: { credentialRotated: true },
    });
    if (audit.error) throw audit.error;

    const response = NextResponse.json({
      ok: true,
      terminal: {
        id: update.data.id,
        gymId: update.data.gym_id,
        name: update.data.name,
        active: update.data.active,
      },
    });
    response.cookies.set({
      name: terminalCookieName(),
      value: `${terminalId}.${secret}`,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not provision Punch Clock terminal." }, { status: 500 });
  }
}
