import { NextRequest, NextResponse } from "next/server";
import {
  getStaffBiometricAdapter,
  StaffBiometricAdapterError,
  type BiometricMatch,
  type StaffBiometricAdapter,
} from "@/lib/staffBiometricAdapter";
import { recordStaffPunch } from "@/lib/staffAttendanceServer";
import { maltaDayUtcRange, todayMaltaDate } from "@/lib/maltaDate";
import { requireStaffTerminal } from "@/lib/staffTerminalRequest";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const photoBucket = "bgm-staff-photos";

function kioskError(code: string, error: string, status: number) {
  return NextResponse.json({ ok: false, code, error }, { status, headers: noStore });
}

function trustedMatch(match: BiometricMatch): BiometricMatch {
  const employeeId = String(match?.employeeId || "").trim();
  const adapterEventId = String(match?.adapterEventId || "").trim();
  const matchedAt = String(match?.matchedAt || "").trim();
  if (!employeeId || !adapterEventId || !matchedAt || Number.isNaN(new Date(matchedAt).getTime())) {
    throw new StaffBiometricAdapterError("invalid_payload", "Fingerprint match was invalid.");
  }
  return { employeeId, adapterEventId, matchedAt: new Date(matchedAt).toISOString() };
}

function overlapMinutes(
  clockInAt: string,
  clockOutAt: string | null,
  rangeStart: string,
  rangeEnd: string,
  openUntil: string,
): number {
  const start = Math.max(new Date(clockInAt).getTime(), new Date(rangeStart).getTime());
  const end = Math.min(
    new Date(clockOutAt || openUntil).getTime(),
    new Date(rangeEnd).getTime(),
  );
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.floor((end - start) / 60_000);
}

async function signedStaffPhotoUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const db = getSupabaseAdmin();
  const signed = await db.storage.from(photoBucket).createSignedUrl(photoPath, 90);
  if (signed.error || !signed.data?.signedUrl) {
    console.error("Could not sign Punch Clock staff photo", signed.error);
    return null;
  }
  return signed.data.signedUrl;
}

export async function handleStaffPunch(
  request: NextRequest,
  adapter: StaffBiometricAdapter = getStaffBiometricAdapter(),
) {
  const auth = await requireStaffTerminal(request);
  if (auth.error || !auth.context) return auth.error;

  try {
    const body: unknown = await request.json().catch(() => null);
    const match = trustedMatch(await adapter.resolveMatch(body));
    const punch = await recordStaffPunch({
      employeeId: match.employeeId,
      eventKey: `biometric:${auth.context.terminalId}:${match.adapterEventId}`,
      sourceTimestamp: new Date(match.matchedAt),
      source: "terminal",
      terminalId: auth.context.terminalId,
    });

    if (punch.outcome === "inactive_employee") {
      return kioskError("inactive_employee", "This employee is inactive. Please contact a manager.", 409);
    }
    if (punch.outcome === "inactive_terminal") {
      return kioskError("inactive_terminal", "This Punch Clock terminal is inactive.", 401);
    }
    if (punch.outcome === "invalid_request") {
      return kioskError("invalid_request", "The punch could not be processed.", 400);
    }

    const db = getSupabaseAdmin();
    const anchor = new Date(punch.effectiveAt || match.matchedAt);
    const businessDate = todayMaltaDate(anchor);
    const dayRange = maltaDayUtcRange(businessDate);
    const [employeeResult, gymResult, sessionsResult] = await Promise.all([
      db
        .from("bgm_staff_employees")
        .select("first_name, surname, photo_path")
        .eq("id", match.employeeId)
        .maybeSingle(),
      db
        .from("bgm_gyms")
        .select("id, name")
        .eq("id", auth.context.gymId)
        .maybeSingle(),
      db
        .from("bgm_staff_work_sessions")
        .select("clock_in_at, clock_out_at")
        .eq("employee_id", match.employeeId)
        .lt("clock_in_at", dayRange.end)
        .or(`clock_out_at.is.null,clock_out_at.gte.${dayRange.start}`),
    ]);

    if (employeeResult.error) throw employeeResult.error;
    if (gymResult.error) throw gymResult.error;
    if (sessionsResult.error) throw sessionsResult.error;
    if (!employeeResult.data || !gymResult.data) {
      return kioskError("confirmation_unavailable", "Punch recorded, but confirmation details are unavailable.", 500);
    }

    const effectiveAt = punch.effectiveAt || match.matchedAt;
    const dailyMinutes = (sessionsResult.data || []).reduce(
      (total, session) => total + overlapMinutes(
        session.clock_in_at,
        session.clock_out_at,
        dayRange.start,
        dayRange.end,
        effectiveAt,
      ),
      0,
    );
    const photoUrl = await signedStaffPhotoUrl(employeeResult.data.photo_path);

    return NextResponse.json(
      {
        ok: true,
        outcome: punch.outcome,
        employee: {
          firstName: employeeResult.data.first_name,
          surname: employeeResult.data.surname,
          photoUrl,
        },
        gym: {
          id: auth.context.gymId,
          name: gymResult.data.name,
        },
        effectiveAt,
        dailyMinutes,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof StaffBiometricAdapterError) {
      if (error.code === "hardware_not_configured") {
        return kioskError("hardware_not_configured", "Fingerprint reader is not configured.", 503);
      }
      if (error.code === "no_match") {
        return kioskError("no_match", "Fingerprint not recognised. Please try again.", 404);
      }
      return kioskError("invalid_payload", "Fingerprint scan could not be read.", 400);
    }

    console.error("Punch Clock punch failed", error);
    return kioskError("punch_failed", "The punch could not be processed. Please try again.", 500);
  }
}

export async function POST(request: NextRequest) {
  return handleStaffPunch(request);
}
