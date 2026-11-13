import { NextRequest, NextResponse } from "next/server";
import { authenticateHu20Terminal, isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private, max-age=0" };

/** Read-only enrollment queue. Never issues a template or a punch. */
export async function GET(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) {
    return NextResponse.json({ ok: false, error: "Unavailable." }, { status: 404, headers });
  }
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) {
      return NextResponse.json({ ok: false, error: "Unauthorised terminal." }, { status: 401, headers });
    }
    const db = getSupabaseAdmin();
    const pending = await db.from("bgm_hu20_enrollment_requests")
      .select("id,employee_id,expires_at")
      .eq("terminal_id", terminal.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }).limit(1);
    if (pending.error) throw pending.error;
    const row = pending.data?.[0];
    if (!row) {
      return NextResponse.json({ ok: true, enrollment: null, fingerprintCaptureEnabled: false },
        { headers });
    }
    const employee = await db.from("bgm_staff_employees")
      .select("id,first_name,surname,active").eq("id", row.employee_id).maybeSingle();
    if (employee.error) throw employee.error;
    if (!employee.data?.active) {
      return NextResponse.json({ ok: true, enrollment: null, fingerprintCaptureEnabled: false },
        { headers });
    }
    return NextResponse.json({
      ok: true,
      enrollment: {
        id: row.id,
        employeeId: employee.data.id,
        employeeName: [employee.data.first_name, employee.data.surname].join(" "),
        expiresAt: row.expires_at,
      },
      fingerprintCaptureEnabled: false,
      notice: "Read-only TEST enrollment authorization; biometric upload remains disabled.",
    }, { headers });
  } catch (error) {
    console.error("HU20 pending enrollment lookup failed", error);
    return NextResponse.json({ ok: false, error: "Cannot load TEST enrollment request." },
      { status: 500, headers });
  }
}
