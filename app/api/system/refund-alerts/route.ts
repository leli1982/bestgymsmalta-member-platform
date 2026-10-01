import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const status = request.nextUrl.searchParams.get("status") === "handled" ? "handled" : "pending";
    const result = await db
      .from("bgm_member_refund_alerts")
      .select("id,member_id,membership_id,application_id,voucher_code,voucher_percentage,original_final_amount_cents,corrected_final_amount_cents,refund_due_cents,currency,member_first_name,member_last_name,member_id_number,member_mobile,status,created_at,handled_at,email_notification_status,email_notification_error")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (result.error) throw result.error;
    return NextResponse.json({ alerts: result.data || [] }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load refund alerts." }, { status: 500, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json();
    const alertId = String(body?.alertId || "").trim();
    if (!UUID.test(alertId)) {
      return NextResponse.json({ error: "Invalid refund alert." }, { status: 400, headers: noStore });
    }
    const db = getSupabaseAdmin();
    const result = await db.rpc("bgm_super_admin_mark_refund_handled", {
      p_system_user_id: auth.context.systemUserId,
      p_alert_id: alertId,
    });
    if (result.error) {
      const message = String(result.error.message || "");
      if (/Super Admin access required/i.test(message)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403, headers: noStore });
      if (/Refund alert not found/i.test(message)) return NextResponse.json({ error: "Refund alert not found." }, { status: 404, headers: noStore });
      throw result.error;
    }
    return NextResponse.json({ ok: true, changed: result.data?.changed === true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not update refund alert." }, { status: 500, headers: noStore });
  }
}
