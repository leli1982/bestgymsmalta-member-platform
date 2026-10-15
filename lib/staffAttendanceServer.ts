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

type RpcRow = {
  outcome?: unknown;
  result_employee_id?: unknown;
  result_session_id?: unknown;
  result_punch_event_id?: unknown;
  result_effective_at?: unknown;
  result_gym_id?: unknown;
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

function parseOutcome(value: unknown): StaffPunchOutcome {
  if (typeof value !== "string" || !allowedOutcomes.has(value as StaffPunchOutcome)) {
    throw new Error("Punch Clock returned an unsupported attendance outcome.");
  }
  return value as StaffPunchOutcome;
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
