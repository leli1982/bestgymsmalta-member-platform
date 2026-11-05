import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireSuperAdmin } from "@/lib/systemAuth";
import { broadcastUrgentStaffAlertRefresh } from "@/lib/urgentStaffAlertsRealtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const clean = (value: unknown) => String(value ?? "").trim();
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const noStore = { "Cache-Control": "private, no-store" };

async function notifyRecipients(alertId: string) {
  const result = await getSupabaseAdmin().from("bgm_urgent_staff_alert_recipients")
    .select("gym_id").eq("alert_id", alertId);
  if (result.error) throw result.error;
  await Promise.all(Array.from(new Set((result.data || []).map(row => row.gym_id)))
    .map(gymId => broadcastUrgentStaffAlertRefresh(gymId)));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    const [alerts, gyms, accounts] = await Promise.all([
      db.from("bgm_urgent_staff_alerts")
        .select("id,subject,message,priority,target_scope,created_at,cancelled_at,created_by_system_user_id,revision")
        .order("created_at", { ascending: false }).limit(60),
      db.from("bgm_gyms").select("id,name,status").eq("status", "active").order("name"),
      db.from("bgm_system_users").select("gym_id").eq("role", "gym_staff").eq("active", true),
    ]);
    if (alerts.error || gyms.error || accounts.error) throw alerts.error || gyms.error || accounts.error;
    const rows = alerts.data || [];
    const targets = rows.length
      ? await db.from("bgm_urgent_staff_alert_recipients")
          .select("alert_id,gym_id,read_by,acknowledged_at,acknowledged_by_system_user_id")
          .in("alert_id", rows.map(row => row.id))
      : { data: [], error: null };
    if (targets.error) throw targets.error;
    const nameById = new Map((gyms.data || []).map(gym => [gym.id, gym.name]));
    const used = new Set((accounts.data || []).map(account => account.gym_id).filter(Boolean));
    return NextResponse.json({
      gyms: (gyms.data || []).filter(gym => used.has(gym.id)).map(gym => ({ id: gym.id, name: gym.name })),
      alerts: rows.map(row => ({
        ...row,
        recipients: (targets.data || []).filter(recipient => recipient.alert_id === row.id)
          .map(recipient => ({ ...recipient, gym_name: nameById.get(recipient.gym_id) || recipient.gym_id })),
      })),
    }, { headers: noStore });
  } catch (error) {
    console.error("Urgent staff alert administration could not load.", error);
    return NextResponse.json({ error: "Could not load urgent staff alerts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action);
    const db = getSupabaseAdmin();

    if (action === "cancel") {
      const alertId = clean(body.alertId);
      if (!validId(alertId)) return NextResponse.json({ error: "Invalid alert." }, { status: 400 });
      const result = await db.rpc("bgm_cancel_urgent_staff_alert", {
        p_alert_id: alertId, p_super_user_id: auth.context.systemUserId,
      });
      if (result.error) throw result.error;
      if (!result.data) return NextResponse.json({ error: "Alert already cancelled or unavailable." }, { status: 409 });
      await notifyRecipients(alertId);
      return NextResponse.json({ ok: true }, { headers: noStore });
    }

    if (action !== "send") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    const subject = clean(body.subject);
    const message = clean(body.message);
    const priority = clean(body.priority);
    const scope = clean(body.scope);
    const gymId = scope === "gym" ? clean(body.gymId) : null;
    if (!subject || subject.length > 160 || !message || message.length > 4000 ||
        !["urgent", "emergency"].includes(priority) ||
        !["gym", "all"].includes(scope) || (scope === "gym" && !gymId)) {
      return NextResponse.json({ error: "Complete the alert details and select a recipient." }, { status: 400 });
    }
    const result = await db.rpc("bgm_create_urgent_staff_alert", {
      p_subject: subject, p_message: message, p_priority: priority,
      p_target_gym_id: gymId, p_all_gyms: scope === "all",
      p_sender: auth.context.systemUserId,
    });
    if (result.error) {
      if (String(result.error.message || "").includes("No active Staff Portal")) {
        return NextResponse.json({ error: "Selected gyms have no active Staff Portal accounts." }, { status: 400 });
      }
      throw result.error;
    }
    const alertId = String(result.data);
    await notifyRecipients(alertId);
    return NextResponse.json({ ok: true, alertId }, { headers: noStore });
  } catch (error) {
    console.error("Urgent staff alert action failed.", error);
    return NextResponse.json({ error: "Could not complete urgent staff alert action." }, { status: 500 });
  }
}
