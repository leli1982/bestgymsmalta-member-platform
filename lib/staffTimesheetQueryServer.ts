import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { maltaDayUtcRange } from "@/lib/maltaDate";
import {
  buildStaffTimesheetEmployeeReport,
  type StaffTimesheetEmployeeReport,
  type StaffTimesheetInputEmployee,
  type StaffTimesheetInputSegment,
  type StaffTimesheetInputSession,
} from "@/lib/staffTimesheetReport";

export type StaffTimesheetFilters = {
  fromDate: string;
  toDate: string;
  employeeId?: string | null;
  homeGymId?: string | null;
  workedGymId?: string | null;
  status?: string | null;
};

export type StaffAttendanceAdjustment = {
  id: string;
  employeeId: string;
  sessionId: string | null;
  action: string;
  actionTime: string;
  effectiveAt: string | null;
  reason: string | null;
  performedBy: string | null;
  beforeState: unknown;
  afterState: unknown;
};

export type StaffTimesheetQueryResult = {
  fromDate: string;
  toDate: string;
  reports: StaffTimesheetEmployeeReport[];
  adjustments: StaffAttendanceAdjustment[];
  gyms: Array<{ id: string; name: string }>;
  generatedAt: string;
  summary: {
    employeeCount: number;
    workedMinutes: number;
    normalPayCents: number;
    holidayPayCents: number;
    payCents: number;
    needsAttention: number;
  };
};

function clean(value: string | null | undefined): string {
  return String(value || "").trim();
}

function assertDateKey(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  maltaDayUtcRange(value);
}

function daysBetweenDateKeys(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000));
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function validateStaffTimesheetRange(fromDate: string, toDate: string) {
  assertDateKey(fromDate, "From date");
  assertDateKey(toDate, "To date");
  const span = daysBetweenDateKeys(fromDate, toDate);
  if (span < 0) throw new Error("From date cannot be after To date.");
  if (span > 92) throw new Error("The maximum timesheet date range is 93 days.");
}

export async function queryStaffTimesheets(filters: StaffTimesheetFilters): Promise<StaffTimesheetQueryResult> {
  const fromDate = clean(filters.fromDate);
  const toDate = clean(filters.toDate);
  validateStaffTimesheetRange(fromDate, toDate);

  const db = getSupabaseAdmin();
  const employeeId = clean(filters.employeeId);
  const homeGymId = clean(filters.homeGymId);
  const workedGymId = clean(filters.workedGymId);
  const status = clean(filters.status);
  const rangeStart = maltaDayUtcRange(fromDate).start;
  const rangeEnd = maltaDayUtcRange(toDate).end;

  const gymsResult = await db.from("bgm_gyms").select("id, name").order("name");
  if (gymsResult.error) throw gymsResult.error;
  const gyms = (gymsResult.data || []).map((row: any) => ({ id: String(row.id), name: String(row.name || row.id) }));
  const gymName = new Map(gyms.map((gym) => [gym.id, gym.name]));

  let employeeQuery = db
    .from("bgm_staff_employees")
    .select("id, first_name, surname, email, home_gym_id, active")
    .order("surname")
    .order("first_name");
  if (employeeId) employeeQuery = employeeQuery.eq("id", employeeId);
  if (homeGymId) employeeQuery = employeeQuery.eq("home_gym_id", homeGymId);
  const employeeResult = await employeeQuery;
  if (employeeResult.error) throw employeeResult.error;
  const employees = employeeResult.data || [];
  const employeeIds = employees.map((row: any) => String(row.id));

  if (employeeIds.length === 0) {
    return {
      fromDate,
      toDate,
      reports: [],
      adjustments: [],
      gyms,
      generatedAt: new Date().toISOString(),
      summary: { employeeCount: 0, workedMinutes: 0, normalPayCents: 0, holidayPayCents: 0, payCents: 0, needsAttention: 0 },
    };
  }

  let sessionQuery = db
    .from("bgm_staff_work_sessions")
    .select("id, employee_id, clock_in_at, clock_out_at, clock_in_gym_id, clock_out_gym_id, status, attention_code")
    .in("employee_id", employeeIds)
    .lt("clock_in_at", rangeEnd)
    .or(`clock_out_at.gte.${rangeStart},clock_out_at.is.null`)
    .order("clock_in_at");
  if (status) sessionQuery = sessionQuery.eq("status", status);
  if (workedGymId) sessionQuery = sessionQuery.or(`clock_in_gym_id.eq.${workedGymId},clock_out_gym_id.eq.${workedGymId}`);
  const sessionResult = await sessionQuery;
  if (sessionResult.error) throw sessionResult.error;
  const sessionRows = sessionResult.data || [];
  const sessionIds = sessionRows.map((row: any) => String(row.id));

  let segmentRows: any[] = [];
  if (sessionIds.length > 0) {
    const segmentResult = await db
      .from("bgm_staff_session_payroll_segments")
      .select("id, session_id, work_date, worked_minutes, hourly_rate_cents, employment_type, holiday_version_id, holiday_multiplier_bps, pay_cents")
      .in("session_id", sessionIds)
      .gte("work_date", fromDate)
      .lte("work_date", toDate)
      .order("work_date");
    if (segmentResult.error) throw segmentResult.error;
    segmentRows = segmentResult.data || [];
  }

  const holidayVersionIds = Array.from(new Set(segmentRows.map((row: any) => clean(row.holiday_version_id)).filter(Boolean)));
  const holidayNameByVersion = new Map<string, string>();
  if (holidayVersionIds.length > 0) {
    const versions = await db
      .from("bgm_staff_public_holiday_versions")
      .select("id, name")
      .in("id", holidayVersionIds);
    if (versions.error) throw versions.error;
    for (const row of versions.data || []) {
      const version = row as any;
      holidayNameByVersion.set(String(version.id), String(version.name || "Public holiday"));
    }
  }

  const sessions: StaffTimesheetInputSession[] = sessionRows.map((row: any) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    clockInAt: String(row.clock_in_at),
    clockOutAt: row.clock_out_at ? String(row.clock_out_at) : null,
    clockInGymId: String(row.clock_in_gym_id || ""),
    clockInGymName: gymName.get(String(row.clock_in_gym_id || "")) || null,
    clockOutGymId: row.clock_out_gym_id ? String(row.clock_out_gym_id) : null,
    clockOutGymName: row.clock_out_gym_id ? gymName.get(String(row.clock_out_gym_id)) || null : null,
    status: String(row.status || "open"),
    attentionCode: row.attention_code ? String(row.attention_code) : null,
  }));

  const segments: StaffTimesheetInputSegment[] = segmentRows.map((row: any) => ({
    id: String(row.id),
    sessionId: String(row.session_id),
    workDate: String(row.work_date),
    workedMinutes: asNumber(row.worked_minutes),
    hourlyRateCents: asNumber(row.hourly_rate_cents),
    employmentType: row.employment_type === "part_time" ? "part_time" : "full_time",
    holidayVersionId: row.holiday_version_id ? String(row.holiday_version_id) : null,
    holidayName: row.holiday_version_id ? holidayNameByVersion.get(String(row.holiday_version_id)) || "Public holiday" : null,
    holidayMultiplierBps: asNumber(row.holiday_multiplier_bps || 10000),
    payCents: asNumber(row.pay_cents),
  }));

  const reports = employees.map((row: any) => {
    const inputEmployee: StaffTimesheetInputEmployee = {
      id: String(row.id),
      firstName: String(row.first_name || ""),
      surname: String(row.surname || ""),
      email: row.email ? String(row.email) : null,
      homeGymName: gymName.get(String(row.home_gym_id || "")) || null,
    };
    const ownSessions = sessions.filter((session) => session.employeeId === inputEmployee.id);
    const ownSessionIds = new Set(ownSessions.map((session) => session.id));
    return buildStaffTimesheetEmployeeReport({
      employee: inputEmployee,
      sessions: ownSessions,
      segments: segments.filter((segment) => ownSessionIds.has(segment.sessionId)),
    });
  });

  let adjustments: StaffAttendanceAdjustment[] = [];
  if (sessionIds.length > 0) {
    const adjustmentResult = await db
      .from("bgm_staff_attendance_adjustments")
      .select("id, employee_id, session_id, reason, actor_system_user_id, before_data, after_data, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false });
    if (adjustmentResult.error) throw adjustmentResult.error;
    adjustments = (adjustmentResult.data || []).map((row: any) => ({
      id: String(row.id),
      employeeId: String(row.employee_id),
      sessionId: row.session_id ? String(row.session_id) : null,
      action: "adjustment",
      actionTime: String(row.created_at),
      effectiveAt: null,
      reason: row.reason ? String(row.reason) : null,
      performedBy: row.actor_system_user_id ? String(row.actor_system_user_id) : null,
      beforeState: row.before_data ?? null,
      afterState: row.after_data ?? null,
    }));
  }

  const summary = reports.reduce((acc, report) => {
    acc.workedMinutes += report.selectedPeriod.workedMinutes;
    acc.normalPayCents += report.selectedPeriod.normalPayCents;
    acc.holidayPayCents += report.selectedPeriod.holidayPayCents;
    acc.payCents += report.selectedPeriod.payCents;
    acc.needsAttention += report.sessions.filter((session) => session.status === "needs_attention" || Boolean(session.attentionCode)).length;
    return acc;
  }, { employeeCount: reports.length, workedMinutes: 0, normalPayCents: 0, holidayPayCents: 0, payCents: 0, needsAttention: 0 });

  return { fromDate, toDate, reports, adjustments, gyms, generatedAt: new Date().toISOString(), summary };
}
