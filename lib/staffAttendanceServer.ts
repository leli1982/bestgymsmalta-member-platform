import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type StaffPunchOutcome =
  | "clocked_in"
  | "clocked_out"
  | "duplicate_ignored"
  | "inactive_employee"
  | "inactive_terminal"
  | "invalid_request";

export type RecordStaffPunchInput = {
  employeeId: string;
  eventKey: string;
  sourceTimestamp?: Date;
  source?: "terminal" | "manual";
  terminalId?: string | null;
  gymId?: string | null;
  actorSystemUserId?: string | null;
  manualReason?: string | null;
};

export type StaffPunchResult = {
  outcome: StaffPunchOutcome;
  employeeId: string | null;
  sessionId: string | null;
  punchEventId: string | null;
  effectiveAt: string | null;
  gymId: string | null;
};

export type CorrectStaffAttendanceSessionInput = {
  sessionId: string;
  clockInAt?: Date | string | null;
  clockInGymId?: string | null;
  clockOutAt?: Date | string | null;
  clockOutGymId?: string | null;
  reason: string;
  actorSystemUserId: string;
  reviewMidnight?: boolean;
};

export type CorrectStaffAttendanceSessionResult = {
  sessionId: string;
  status: string;
  payrollStatus: string;
};

type RpcRow = {
  outcome?: unknown;
  result_employee_id?: unknown;
  result_session_id?: unknown;
  result_punch_event_id?: unknown;
  result_effective_at?: unknown;
  result_gym_id?: unknown;
};

type CorrectionRpcRow = {
  result_session_id?: unknown;
  result_status?: unknown;
  payroll_status?: unknown;
};

const allowedOutcomes = new Set<StaffPunchOutcome>([
  "clocked_in",
  "clocked_out",
  "duplicate_ignored",
  "inactive_employee",
  "inactive_terminal",
  "invalid_request",
]);

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, label: string): string {
  const result = optionalString(value);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function parseOutcome(value: unknown): StaffPunchOutcome {
  if (typeof value !== "string" || !allowedOutcomes.has(value as StaffPunchOutcome)) {
    throw new Error("Punch Clock returned an unsupported attendance outcome.");
  }
  return value as StaffPunchOutcome;
}

function optionalTimestamp(value: Date | string | null | undefined): string | null {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid attendance timestamp is required.");
  return date.toISOString();
}

export async function recordStaffPunch(
  input: RecordStaffPunchInput,
): Promise<StaffPunchResult> {
  const employeeId = String(input.employeeId || "").trim();
  const eventKey = String(input.eventKey || "").trim();
  if (!employeeId || !eventKey) {
    throw new Error("Employee and event key are required.");
  }

  const sourceTimestamp = input.sourceTimestamp ?? new Date();
  if (Number.isNaN(sourceTimestamp.getTime())) {
    throw new Error("A valid punch timestamp is required.");
  }

  const supabase = getSupabaseAdmin();
  const result = await supabase.rpc("bgm_staff_record_punch", {
    p_employee_id: employeeId,
    p_event_key: eventKey,
    p_source_timestamp: sourceTimestamp.toISOString(),
    p_source: input.source ?? "terminal",
    p_terminal_id: input.terminalId ?? null,
    p_gym_id: input.gymId ?? null,
    p_actor_system_user_id: input.actorSystemUserId ?? null,
    p_manual_reason: input.manualReason ?? null,
  });

  if (result.error) throw result.error;

  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as RpcRow | null;
  if (!row) throw new Error("Punch Clock returned no attendance result.");

  return {
    outcome: parseOutcome(row.outcome),
    employeeId: optionalString(row.result_employee_id),
    sessionId: optionalString(row.result_session_id),
    punchEventId: optionalString(row.result_punch_event_id),
    effectiveAt: optionalString(row.result_effective_at),
    gymId: optionalString(row.result_gym_id),
  };
}

export async function correctStaffAttendanceSession(
  input: CorrectStaffAttendanceSessionInput,
): Promise<CorrectStaffAttendanceSessionResult> {
  const sessionId = requiredString(input.sessionId, "Session");
  const reason = requiredString(input.reason, "Correction reason");
  const actorSystemUserId = requiredString(input.actorSystemUserId, "Super Admin actor");
  const supabase = getSupabaseAdmin();

  const result = await supabase.rpc("bgm_staff_correct_session", {
    p_session_id: sessionId,
    p_clock_in_at: optionalTimestamp(input.clockInAt),
    p_clock_in_gym_id: optionalString(input.clockInGymId),
    p_clock_out_at: optionalTimestamp(input.clockOutAt),
    p_clock_out_gym_id: optionalString(input.clockOutGymId),
    p_reason: reason,
    p_actor_system_user_id: actorSystemUserId,
    p_review_midnight: Boolean(input.reviewMidnight),
  });

  if (result.error) throw result.error;
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as CorrectionRpcRow | null;
  if (!row) throw new Error("Attendance correction returned no result.");

  return {
    sessionId: requiredString(row.result_session_id, "Corrected session"),
    status: requiredString(row.result_status, "Correction status"),
    payrollStatus: requiredString(row.payroll_status, "Payroll status"),
  };
}
