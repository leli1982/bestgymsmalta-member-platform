import { NextRequest, NextResponse } from "next/server";
import { authenticateHu20Terminal, isHu20TestRequestEnabled } from "@/lib/hu20TerminalServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { openHu20Template } from "@/lib/hu20BiometricVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private, max-age=0", "Pragma": "no-cache" };
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}
function enabled() {
  return isHu20TestRequestEnabled() && process.env.BGM_HU20_RECOGNITION_TEST_ENABLED === "true";
}

/**
 * One-shot TEST roster access. Terminal authentication plus an independently
 * approved, five-minute Super Admin session are BOTH required.
 * Only fictional HU20-TEST employee credentials may be distributed.
 * Templates are decrypted solely into transient server and Windows RAM.
 */
export async function POST(request: NextRequest) {
  if (!enabled()) return fail("Unavailable.", 404);
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) return fail("Unauthorised terminal.", 401);
    const db = getSupabaseAdmin();
    const employees = await db.from("bgm_staff_employees")
      .select("id,first_name,surname").eq("active",true)
      .like("id_number","HU20-TEST-%").limit(9);
    if (employees.error) throw employees.error;
    if ((employees.data || []).length > 8) return fail("TEST roster too large.", 409);
    const people = new Map((employees.data || []).map(employee =>
      [employee.id, [employee.first_name,employee.surname].join(" ")]));
    const employeeIds = Array.from(people.keys());
    const records = employeeIds.length === 0
      ? { data: [], error: null }
      : await db.from("bgm_staff_biometrics")
        .select("id,employee_id,encrypted_template,template_version")
        .in("employee_id",employeeIds)
        .eq("adapter_key","secugen-hu20-ansi378-v1")
        .eq("active",true).eq("status","enrolled")
        .order("enrolled_at",{ascending:true}).limit(9);
    if (records.error) throw records.error;
    if ((records.data || []).length > 8) return fail("TEST roster too large.", 409);
    if ((records.data || []).some(rec =>
      !rec.encrypted_template || rec.template_version !== "ANSI378" ||
      !people.has(rec.employee_id))) return fail("Invalid TEST template reference.", 409);

    // Atomic single-use claim protects against concurrent/duplicate roster fetches.
    const kioskMode = request.headers.get("x-bgm-hu20-kiosk-test") === "1";
    if (kioskMode && (process.env.BGM_HU20_KIOSK_TEST_ENABLED !== "true" ||
        process.env.BGM_HU20_ATTENDANCE_TEST_ENABLED !== "true")) {
      return fail("HU20 unattended TEST kiosk unavailable.", 404);
    }
    const claimed = await db.rpc(
      kioskMode ? "bgm_hu20_test_claim_kiosk_recognition" : "bgm_hu20_test_claim_recognition",
      { p_terminal_id: terminal.id },
    );
    if (claimed.error?.code === "P0002" && kioskMode) return fail("TEST kiosk cooldown. Retry later.", 429);
    if (claimed.error?.code === "P0001") return fail(
      kioskMode ? "No active fictional TEST kiosk window." : "No active Super Admin recognition authorisation.", 409);
    if (claimed.error) throw claimed.error;
    const session = Array.isArray(claimed.data) ? claimed.data[0] : claimed.data;
    if (!session?.test_id || !session?.valid_until) {
      throw new Error("Recognition claim did not return a valid session.");
    }

    const roster = [];
    for (const record of records.data || []) {
      let template: Buffer | null = null;
      try {
        template = openHu20Template(record.encrypted_template, {
          employeeId: record.employee_id,
          credentialId: record.id,
          templateFormat: "ANSI378",
        }, process.env);
        roster.push({
          credentialId: record.id,
          employeeName: people.get(record.employee_id),
          templateFormat: "ANSI378",
          templateBase64: template.toString("base64"),
        });
      } finally {
        if (template) template.fill(0);
      }
    }
    return NextResponse.json({
      ok: true,
      testId: session.test_id,
      expiresAt: session.valid_until,
      roster,
      fingerprintMatchingOnTerminal: true,
      attendanceEnabled: false,
      vendorSecurityLevel: "NORMAL_TEST_ONLY",
      kioskTestOnly: kioskMode,
    }, { headers });
  } catch (error) {
    console.error("HU20 recognition TEST roster failed", error instanceof Error ? error.name : "unknown");
    return fail("Unable to start TEST recognition.", 500);
  }
}
