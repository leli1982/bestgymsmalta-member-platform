import { todayMaltaDate } from "./maltaDate.ts";

export type StaffTimesheetInputEmployee = {
  id: string;
  firstName: string;
  surname: string;
  email: string | null;
  homeGymName: string | null;
  currentHourlyRateCents?: number | null;
};

export type StaffTimesheetInputSession = {
  id: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt: string | null;
  clockInGymId: string;
  clockInGymName: string | null;
  clockOutGymId: string | null;
  clockOutGymName: string | null;
  status: string;
  attentionCode?: string | null;
};

export type StaffTimesheetInputSegment = {
  id: string;
  sessionId: string;
  workDate: string;
  workedMinutes: number;
  hourlyRateCents: number;
  employmentType: "full_time" | "part_time";
  holidayVersionId: string | null;
  holidayName?: string | null;
  holidayMultiplierBps: number;
  payCents: number;
};

export type StaffTimesheetSession = StaffTimesheetInputSession & {
  workedMinutes: number | null;
  payCents: number | null;
};

export type StaffTimesheetAllocation = StaffTimesheetInputSegment & {
  status: string;
  attentionCode: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  clockInGymName: string | null;
  clockOutGymName: string | null;
};

export type StaffTimesheetOpenAllocation = {
  id: string;
  sessionId: string;
  workDate: string;
  workedMinutes: null;
  hourlyRateCents: null;
  employmentType: null;
  holidayVersionId: null;
  holidayName: null;
  holidayMultiplierBps: null;
  payCents: null;
  status: string;
  attentionCode: string | null;
  clockInAt: string;
  clockOutAt: null;
  clockInGymName: string | null;
  clockOutGymName: null;
};

export type StaffTimesheetDay = {
  date: string;
  allocations: Array<StaffTimesheetAllocation | StaffTimesheetOpenAllocation>;
  workedMinutes: number;
  payCents: number;
  normalPayCents: number;
  holidayPayCents: number;
};

export type StaffPeriodTotal = {
  key: string;
  workedMinutes: number;
  payCents: number;
  normalPayCents: number;
  holidayPayCents: number;
};

export type StaffTimesheetEmployeeReport = {
  employee: {
    id: string;
    name: string;
    email: string | null;
    homeGymName: string | null;
  };
  sessions: StaffTimesheetSession[];
  days: StaffTimesheetDay[];
  weeklyTotals: StaffPeriodTotal[];
  monthlyTotals: StaffPeriodTotal[];
  selectedPeriod: {
    workedMinutes: number;
    payCents: number;
    normalPayCents: number;
    holidayPayCents: number;
  };
};

export type BuildStaffTimesheetEmployeeReportInput = {
  employee: StaffTimesheetInputEmployee;
  sessions: StaffTimesheetInputSession[];
  segments: StaffTimesheetInputSegment[];
};

function mondayWeekKey(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(probe.getTime())) throw new Error("Invalid staff timesheet date.");
  const daysSinceMonday = (probe.getUTCDay() + 6) % 7;
  probe.setUTCDate(probe.getUTCDate() - daysSinceMonday);
  return probe.toISOString().slice(0, 10);
}

function accumulate(
  target: { workedMinutes: number; payCents: number; normalPayCents: number; holidayPayCents: number },
  segment: StaffTimesheetInputSegment,
) {
  target.workedMinutes += segment.workedMinutes;
  target.payCents += segment.payCents;
  if (segment.holidayVersionId) target.holidayPayCents += segment.payCents;
  else target.normalPayCents += segment.payCents;
}

function periodTotals(
  segments: StaffTimesheetInputSegment[],
  keyFor: (date: string) => string,
): StaffPeriodTotal[] {
  const totals = new Map<string, StaffPeriodTotal>();
  for (const segment of segments) {
    const key = keyFor(segment.workDate);
    const row = totals.get(key) || {
      key,
      workedMinutes: 0,
      payCents: 0,
      normalPayCents: 0,
      holidayPayCents: 0,
    };
    accumulate(row, segment);
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function buildStaffTimesheetEmployeeReport(
  input: BuildStaffTimesheetEmployeeReportInput,
): StaffTimesheetEmployeeReport {
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const segmentsBySession = new Map<string, StaffTimesheetInputSegment[]>();
  for (const segment of input.segments) {
    const rows = segmentsBySession.get(segment.sessionId) || [];
    rows.push(segment);
    segmentsBySession.set(segment.sessionId, rows);
  }

  const sessions: StaffTimesheetSession[] = input.sessions
    .map((session) => {
      const segments = segmentsBySession.get(session.id) || [];
      if (segments.length === 0) {
        return { ...session, workedMinutes: null, payCents: null };
      }
      return {
        ...session,
        workedMinutes: segments.reduce((sum, row) => sum + row.workedMinutes, 0),
        payCents: segments.reduce((sum, row) => sum + row.payCents, 0),
      };
    })
    .sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));

  const days = new Map<string, StaffTimesheetDay>();
  const ensureDay = (date: string) => {
    let row = days.get(date);
    if (!row) {
      row = {
        date,
        allocations: [],
        workedMinutes: 0,
        payCents: 0,
        normalPayCents: 0,
        holidayPayCents: 0,
      };
      days.set(date, row);
    }
    return row;
  };

  for (const segment of input.segments) {
    const session = sessionById.get(segment.sessionId);
    if (!session) continue;
    const allocation: StaffTimesheetAllocation = {
      ...segment,
      status: session.status,
      attentionCode: session.attentionCode ?? null,
      clockInAt: session.clockInAt,
      clockOutAt: session.clockOutAt,
      clockInGymName: session.clockInGymName,
      clockOutGymName: session.clockOutGymName,
    };
    const day = ensureDay(segment.workDate);
    day.allocations.push(allocation);
    accumulate(day, segment);
  }

  for (const session of input.sessions) {
    if ((segmentsBySession.get(session.id) || []).length > 0) continue;
    const workDate = todayMaltaDate(new Date(session.clockInAt));
    const day = ensureDay(workDate);
    day.allocations.push({
      id: `open:${session.id}`,
      sessionId: session.id,
      workDate,
      workedMinutes: null,
      hourlyRateCents: null,
      employmentType: null,
      holidayVersionId: null,
      holidayName: null,
      holidayMultiplierBps: null,
      payCents: null,
      status: session.status,
      attentionCode: session.attentionCode ?? null,
      clockInAt: session.clockInAt,
      clockOutAt: null,
      clockInGymName: session.clockInGymName,
      clockOutGymName: null,
    });
  }

  const sortedDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sortedDays) {
    day.allocations.sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
  }

  const selectedPeriod = {
    workedMinutes: 0,
    payCents: 0,
    normalPayCents: 0,
    holidayPayCents: 0,
  };
  for (const segment of input.segments) accumulate(selectedPeriod, segment);

  return {
    employee: {
      id: input.employee.id,
      name: `${input.employee.firstName} ${input.employee.surname}`.trim(),
      email: input.employee.email,
      homeGymName: input.employee.homeGymName,
    },
    sessions,
    days: sortedDays,
    weeklyTotals: periodTotals(input.segments, mondayWeekKey),
    monthlyTotals: periodTotals(input.segments, (date) => date.slice(0, 7)),
    selectedPeriod,
  };
}
