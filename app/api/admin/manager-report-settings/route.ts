import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireSuperAdmin(request: NextRequest) {
  if (isAdminRequest(request)) return { context: null, error: null };
  const context = await getSystemContext(request);
  if (!context) return { context: null, error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!context.isSuperAdmin) {
    return { context: null, error: NextResponse.json({ error: "Super Admin access is required." }, { status: 403 }) };
  }
  return { context, error: null };
}

function normalizeReportWhatsappNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) {
    throw new Error("Enter a valid WhatsApp number including country code, for example +356 7900 0000.");
  }
  return digits;
}

async function requireManager(managerUserId: string) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("bgm_system_users")
    .select("id,role,is_super_admin,report_whatsapp_number")
    .eq("id", managerUserId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data || result.data.is_super_admin || result.data.role !== "gym_manager") return null;
  return result.data;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;
    const managerUserId = String(request.nextUrl.searchParams.get("managerUserId") || "").trim();
    if (!managerUserId) return NextResponse.json({ error: "Missing Gym Manager ID." }, { status: 400 });
    const manager = await requireManager(managerUserId);
    if (!manager) return NextResponse.json({ error: "Gym Manager not found." }, { status: 404 });
    return NextResponse.json({
      reportWhatsappNumber: manager.report_whatsapp_number || null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load Gym Manager report settings:", error);
    return NextResponse.json({ error: "Could not load Gym Manager report settings." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error) return auth.error;
    const body = await request.json();
    const managerUserId = String(body.managerUserId || "").trim();
    if (!managerUserId) return NextResponse.json({ error: "Missing Gym Manager ID." }, { status: 400 });
    const manager = await requireManager(managerUserId);
    if (!manager) return NextResponse.json({ error: "Gym Manager not found." }, { status: 404 });

    let reportWhatsappNumber: string | null;
    try {
      reportWhatsappNumber = normalizeReportWhatsappNumber(body.reportWhatsappNumber);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid WhatsApp number." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const updateResult = await supabase
      .from("bgm_system_users")
      .update({ report_whatsapp_number: reportWhatsappNumber, updated_at: new Date().toISOString() })
      .eq("id", managerUserId)
      .select("id,report_whatsapp_number")
      .single();
    if (updateResult.error) throw updateResult.error;

    if (auth.context) {
      const auditResult = await supabase.from("bgm_audit_log").insert({
        system_user_id: auth.context.systemUserId,
        context_gym_id: auth.context.gymId,
        staff_name: null,
        action_key: "gym_manager.report_whatsapp.updated",
        entity_type: "system_user",
        entity_id: managerUserId,
        after_data: { reportWhatsappNumber: updateResult.data.report_whatsapp_number || null },
      });
      if (auditResult.error) throw auditResult.error;
    }

    return NextResponse.json({ reportWhatsappNumber: updateResult.data.report_whatsapp_number || null });
  } catch (error) {
    console.error("Could not update Gym Manager report settings:", error);
    return NextResponse.json({ error: "Could not update Gym Manager report settings." }, { status: 500 });
  }
}
