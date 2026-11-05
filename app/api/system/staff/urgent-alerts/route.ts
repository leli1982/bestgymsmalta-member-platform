import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSystemContext } from "@/lib/systemAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function requireGymStaff(request: NextRequest) {
  const context = await getSystemContext(request);
  if (!context) return { context: null, error: NextResponse.json({ error: "Staff login required." }, { status: 401 }) };
  if (context.role !== "gym_staff" || !context.gymId)
    return { context: null, error: NextResponse.json({ error: "Gym Staff Portal account required." }, { status: 403 }) };
  return { context, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGymStaff(request);
    if (auth.error || !auth.context) return auth.error;
    const db = getSupabaseAdmin();
    // Recipient gym comes from the authenticated session, never URL parameters.
    const pending = await db.from("bgm_urgent_staff_alert_recipients")
      .select("alert_id").eq("gym_id", auth.context.gymId).is("acknowledged_at", null);
    if (pending.error) throw pending.error;
    const ids = (pending.data || []).map(row => row.alert_id);
    if (!ids.length) return NextResponse.json({ alerts: [] }, { headers: noStore });
    const alerts = await db.from("bgm_urgent_staff_alerts")
      .select("id,subject,message,priority,created_at,revision")
      .in("id", ids).is("cancelled_at", null)
      .order("created_at", { ascending: true }).limit(60);
    if (alerts.error) throw alerts.error;
    return NextResponse.json({ alerts: alerts.data || [] }, { headers: noStore });
  } catch (error) {
    console.error("Could not fetch pending Staff Portal alerts.", error);
    return NextResponse.json({ error: "Could not load staff alerts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireGymStaff(request);
    if (auth.error || !auth.context) return auth.error;
    const body = await request.json().catch(() => ({}));
    const alertId = String(body.alertId ?? "").trim();
    const readBy = String(body.readBy ?? "").trim();
    if (!validId(alertId) || readBy.length < 1 || readBy.length > 100) {
      return NextResponse.json({ error: "Enter your name in Read by." }, { status: 400 });
    }
    const result = await getSupabaseAdmin().rpc("bgm_acknowledge_urgent_staff_alert", {
      p_alert_id: alertId, p_gym_id: auth.context.gymId,
      p_staff_user_id: auth.context.systemUserId, p_read_by: readBy,
    });
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({
      error: "Alert already acknowledged, cancelled or not addressed to your gym. Refresh the list.",
    }, { status: 409 });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Urgent staff alert acknowledgement failed.", error);
    return NextResponse.json({ error: "Acknowledgement was not confirmed. Please retry." }, { status: 500 });
  }
}
