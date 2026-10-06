import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { createTerminalSecret, hashTerminalSecret } from "@/lib/staffTerminalAuth";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function gymExists(gymId: string) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bgm_gyms")
    .select("id")
    .eq("id", gymId)
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const supabase = getSupabaseAdmin();
    const [terminalsResult, gymsResult] = await Promise.all([
      supabase
        .from("bgm_staff_terminals")
        .select("id, gym_id, name, active, last_seen_at, created_at, updated_at")
        .order("name", { ascending: true }),
      supabase
        .from("bgm_gyms")
        .select("id, name, status")
        .order("name", { ascending: true }),
    ]);
    if (terminalsResult.error) throw terminalsResult.error;
    if (gymsResult.error) throw gymsResult.error;

    return NextResponse.json({
      terminals: (terminalsResult.data || []).map((terminal) => ({
        id: terminal.id,
        gymId: terminal.gym_id,
        name: terminal.name,
        active: terminal.active,
        lastSeenAt: terminal.last_seen_at,
        createdAt: terminal.created_at,
        updatedAt: terminal.updated_at,
      })),
      gyms: gymsResult.data || [],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load Punch Clock terminals." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;

    const body = await request.json().catch(() => null);
    const name = clean(body?.name);
    const gymId = clean(body?.gymId);
    if (!name || !gymId) {
      return NextResponse.json({ error: "Terminal name and gym are required." }, { status: 400 });
    }
    if (!(await gymExists(gymId))) {
      return NextResponse.json({ error: "Gym not found." }, { status: 400 });
    }

    const secret = createTerminalSecret();
    const credentialHash = hashTerminalSecret(secret);
    const supabase = getSupabaseAdmin();
    const insert = await supabase
      .from("bgm_staff_terminals")
      .insert({
        gym_id: gymId,
        name,
        credential_hash: credentialHash,
        active: true,
        created_by_system_user_id: auth.context.systemUserId,
      })
      .select("id, gym_id, name, active, last_seen_at, created_at, updated_at")
      .single();
    if (insert.error) throw insert.error;

    const audit = await supabase.from("bgm_audit_log").insert({
      system_user_id: auth.context.systemUserId,
      context_gym_id: gymId,
      action_key: "staff.terminal.created",
      entity_type: "staff_terminal",
      entity_id: insert.data.id,
      after_data: {
        gymId,
        name,
        active: true,
      },
    });
    if (audit.error) throw audit.error;

    return NextResponse.json(
      {
        terminal: {
          id: insert.data.id,
          gymId: insert.data.gym_id,
          name: insert.data.name,
          active: insert.data.active,
          lastSeenAt: insert.data.last_seen_at,
          createdAt: insert.data.created_at,
          updatedAt: insert.data.updated_at,
        },
        provisioning: {
          terminalId: insert.data.id,
          secret,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create Punch Clock terminal." }, { status: 500 });
  }
}
