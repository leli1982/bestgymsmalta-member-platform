import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isHu20TestRequestEnabled, authenticateHu20Terminal } from "@/lib/hu20TerminalServer";
import { validHu20TerminalId } from "@/lib/hu20TerminalSecurity";
import { sealHu20Template } from "@/lib/hu20BiometricVault";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private, max-age=0" };

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

/** TEST: only an authorised terminal can complete a Super Admin enrollment request. */
export async function POST(request: NextRequest) {
  if (!isHu20TestRequestEnabled()) return fail("Unavailable.", 404);
  if (process.env.BGM_HU20_ENROLL_UPLOAD_ENABLED !== "true") return fail("Enrollment uploads disabled.", 423);
  let template: Buffer | null = null;
  try {
    const terminal = await authenticateHu20Terminal(request);
    if (!terminal) return fail("Unauthorised terminal.", 401);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) {
      return fail("JSON required.", 415);
    }
    const claimedSize = Number(request.headers.get("content-length"));
    if (claimedSize > 93000) return fail("Payload too large.", 413);
    const raw = await request.text();
    if (raw.length > 93000) return fail("Payload too large.", 413);
    const body = JSON.parse(raw);
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const templateBase64 = typeof body?.templateBase64 === "string" ? body.templateBase64 : "";
    if (!validHu20TerminalId(requestId) || body?.templateFormat !== "ANSI378" ||
        templateBase64.length < 84 || templateBase64.length > 87384 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(templateBase64)) {
      return fail("Invalid supervised enrollment payload.", 400);
    }
    template = Buffer.from(templateBase64, "base64");
    if (template.byteLength < 64 || template.byteLength > 65536 ||
        template.toString("base64") !== templateBase64) {
      return fail("Invalid fingerprint template encoding.", 400);
    }
    const db = getSupabaseAdmin();
    const pending = await db.from("bgm_hu20_enrollment_requests")
      .select("id,employee_id,terminal_id,status,expires_at")
      .eq("id", requestId).maybeSingle();
    if (pending.error) throw pending.error;
    if (!pending.data || pending.data.terminal_id !== terminal.id ||
        pending.data.status !== "pending" ||
        new Date(pending.data.expires_at).getTime() <= Date.now()) {
      return fail("Enrollment request expired, used or not assigned to terminal.", 409);
    }
    const credentialId = randomUUID();
    const encryptedTemplate = sealHu20Template(template, {
      employeeId: pending.data.employee_id,
      credentialId,
      templateFormat: "ANSI378",
    }, process.env);
    const completed = await db.rpc("bgm_hu20_test_complete_enrollment", {
      p_request_id: requestId,
      p_terminal_id: terminal.id,
      p_credential_id: credentialId,
      p_encrypted_template: encryptedTemplate,
    });
    if (completed.error?.code === "P0001" || completed.error?.code === "23505") {
      return fail("Enrollment authorization is unavailable or already consumed.", 409);
    }
    if (completed.error) throw completed.error;
    const result = Array.isArray(completed.data) ? completed.data[0] : completed.data;
    if (!result || result.biometric_id !== credentialId ||
        result.employee_id !== pending.data.employee_id) {
      throw new Error("Enrollment transaction did not confirm biometric identity.");
    }
    return NextResponse.json({
      ok: true,
      enrollmentRequestId: requestId,
      biometricId: credentialId,
      attendanceEnabled: false,
      message: "Encrypted HU20 TEST biometric enrollment completed.",
    }, { status: 201, headers });
  } catch (error) {
    // No raw template, request body, encryption key or terminal secret in logs.
    console.error("HU20 supervised TEST enrollment failed", error instanceof Error ? error.name : "error");
    return fail("Could not complete supervised TEST enrollment.", 500);
  } finally {
    if (template) template.fill(0);
  }
}
