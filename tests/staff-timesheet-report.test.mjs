import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffTimesheetEmployeeReport } from "../lib/staffTimesheetReport.ts";

const employee = {
  id: "emp-1",
  firstName: "Alex",
  surname: "Borg",
  email: "alex@example.test",
  homeGymName: "Tal-Qroqq",
  currentHourlyRateCents: 1250,
};

function session(overrides = {}) {
  return {
    id: "session-1",
    employeeId: "emp-1",
    clockInAt: "2026-10-05T06:00:00.000Z",
    clockOutAt: "2026-10-05T08:00:00.000Z",
    clockInGymId: "gym-a",
    clockInGymName: "Tal-Qroqq",
    clockOutGymId: "gym-a",
    clockOutGymName: "Tal-Qroqq",
    status: "closed",
    attentionCode: null,
    ...overrides,
  };
}

function segment(overrides = {}) {
  return {
    id: "seg-1",
    sessionId: "session-1",
    workDate: "2026-10-05",
    workedMinutes: 120,
    hourlyRateCents: 850,
    employmentType: "full_time",
    holidayVersionId: null,
    holidayName: null,
    holidayMultiplierBps: 10000,
    payCents: 1700,
    ...overrides,
  };
}

test("two IN/OUT pairs on one day remain separate while daily and selected-period totals sum them", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [
      session(),
      session({
        id: "session-2",
        clockInAt: "2026-10-05T12:00:00.000Z",
        clockOutAt: "2026-10-05T13:30:00.000Z",
      }),
    ],
    segments: [
      segment(),
      segment({ id: "seg-2", sessionId: "session-2", workedMinutes: 90, payCents: 1275 }),
    ],
  });

  assert.equal(report.sessions.length, 2);
  assert.equal(report.days.length, 1);
  assert.equal(report.days[0].allocations.length, 2);
  assert.equal(report.days[0].workedMinutes, 210);
  assert.equal(report.days[0].payCents, 2975);
  assert.equal(report.selectedPeriod.workedMinutes, 210);
  assert.equal(report.selectedPeriod.payCents, 2975);
});

test("cross-gym IN and OUT labels are retained distinctly", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [session({ clockOutGymId: "gym-b", clockOutGymName: "Marsa" })],
    segments: [segment()],
  });

  assert.equal(report.sessions[0].clockInGymName, "Tal-Qroqq");
  assert.equal(report.sessions[0].clockOutGymName, "Marsa");
});

test("one cross-midnight session appears across two daily allocations without becoming two sessions", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [session({
      clockInAt: "2026-10-05T20:00:00.000Z",
      clockOutAt: "2026-10-06T04:00:00.000Z",
    })],
    segments: [
      segment({ id: "seg-a", workDate: "2026-10-05", workedMinutes: 120, payCents: 1700 }),
      segment({ id: "seg-b", workDate: "2026-10-06", workedMinutes: 360, payCents: 5100 }),
    ],
  });

  assert.equal(report.sessions.length, 1);
  assert.deepEqual(report.days.map((day) => [day.date, day.workedMinutes]), [
    ["2026-10-05", 120],
    ["2026-10-06", 360],
  ]);
  assert.equal(report.days[0].allocations[0].sessionId, "session-1");
  assert.equal(report.days[1].allocations[0].sessionId, "session-1");
  assert.equal(report.selectedPeriod.workedMinutes, 480);
});

test("Monday-Sunday weekly totals and calendar-month totals use persisted segments", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [
      session(),
      session({ id: "session-2", clockInAt: "2026-10-11T06:00:00.000Z", clockOutAt: "2026-10-11T07:00:00.000Z" }),
      session({ id: "session-3", clockInAt: "2026-10-12T06:00:00.000Z", clockOutAt: "2026-10-12T07:00:00.000Z" }),
      session({ id: "session-4", clockInAt: "2026-11-02T06:00:00.000Z", clockOutAt: "2026-11-02T07:00:00.000Z" }),
    ],
    segments: [
      segment(),
      segment({ id: "seg-2", sessionId: "session-2", workDate: "2026-10-11", workedMinutes: 60, payCents: 850 }),
      segment({ id: "seg-3", sessionId: "session-3", workDate: "2026-10-12", workedMinutes: 60, payCents: 850 }),
      segment({ id: "seg-4", sessionId: "session-4", workDate: "2026-11-02", workedMinutes: 60, payCents: 850 }),
    ],
  });

  assert.deepEqual(report.weeklyTotals.map((row) => [row.key, row.workedMinutes]), [
    ["2026-10-05", 180],
    ["2026-10-12", 60],
    ["2026-11-02", 60],
  ]);
  assert.deepEqual(report.monthlyTotals.map((row) => [row.key, row.workedMinutes]), [
    ["2026-10", 240],
    ["2026-11", 60],
  ]);
});

test("normal and public-holiday pay are separated while total pay remains authoritative", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [
      session(),
      session({ id: "session-holiday", clockInAt: "2026-10-06T06:00:00.000Z", clockOutAt: "2026-10-06T08:00:00.000Z" }),
    ],
    segments: [
      segment(),
      segment({
        id: "seg-holiday",
        sessionId: "session-holiday",
        workDate: "2026-10-06",
        holidayVersionId: "holiday-v1",
        holidayName: "National Holiday",
        holidayMultiplierBps: 20000,
        payCents: 3400,
      }),
    ],
  });

  assert.equal(report.selectedPeriod.normalPayCents, 1700);
  assert.equal(report.selectedPeriod.holidayPayCents, 3400);
  assert.equal(report.selectedPeriod.payCents, 5100);
  assert.equal(report.days[1].allocations[0].holidayName, "National Holiday");
  assert.equal(report.days[1].allocations[0].holidayMultiplierBps, 20000);
});

test("open session remains visible without invented OUT time, duration or pay", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [session({ id: "open-1", clockOutAt: null, clockOutGymId: null, clockOutGymName: null, status: "open" })],
    segments: [],
  });

  assert.equal(report.sessions.length, 1);
  assert.equal(report.sessions[0].status, "open");
  assert.equal(report.sessions[0].clockOutAt, null);
  assert.equal(report.sessions[0].workedMinutes, null);
  assert.equal(report.sessions[0].payCents, null);
  assert.equal(report.days[0].allocations[0].workedMinutes, null);
  assert.equal(report.selectedPeriod.workedMinutes, 0);
  assert.equal(report.selectedPeriod.payCents, 0);
});

test("needs-attention session remains explicitly flagged", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee,
    sessions: [session({ status: "needs_attention", attentionCode: "midnight_auto_clock_out" })],
    segments: [segment()],
  });

  assert.equal(report.sessions[0].status, "needs_attention");
  assert.equal(report.sessions[0].attentionCode, "midnight_auto_clock_out");
  assert.equal(report.days[0].allocations[0].status, "needs_attention");
});

test("historical report uses persisted snapshot pay even when employee current rate and later config differ", () => {
  const report = buildStaffTimesheetEmployeeReport({
    employee: { ...employee, currentHourlyRateCents: 5000 },
    sessions: [session()],
    segments: [segment({ hourlyRateCents: 850, payCents: 1700, holidayMultiplierBps: 10000 })],
  });

  assert.equal(report.selectedPeriod.payCents, 1700);
  assert.equal(report.days[0].allocations[0].hourlyRateCents, 850);
  assert.notEqual(report.selectedPeriod.payCents, 10000);
});
