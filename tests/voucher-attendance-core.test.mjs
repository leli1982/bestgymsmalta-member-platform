import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const coreUrl = new URL("../lib/voucherAttendanceCore.ts", import.meta.url);

assert.ok(
  existsSync(fileURLToPath(coreUrl)),
  "voucherAttendanceCore.ts must exist before voucher attendance behavior can pass"
);

const {
  summariseVoucherAttendance,
  voucherAttendanceStatus,
} = await import(coreUrl.href);

function checkin(id, memberId, gymId, gymName, checkinAt) {
  return { id, memberId, gymId, gymName, checkinAt };
}

test("attendance uses eligible calendar days and counts multiple same-day visits only once for attendance percentage", () => {
  const result = summariseVoucherAttendance({
    reportFrom: "2026-10-01",
    reportTo: "2026-10-07",
    eligibility: [{ startDate: "2026-10-01", endDate: "2026-10-07" }],
    checkins: [
      checkin("1", "m1", "marsa", "Marsa", "2026-10-01T08:00:00Z"),
      checkin("2", "m1", "marsa", "Marsa", "2026-10-01T17:00:00Z"),
      checkin("3", "m1", "sliema", "Sliema", "2026-10-03T08:00:00Z"),
    ],
  });

  assert.equal(result.eligibleDays, 7);
  assert.equal(result.attendedDays, 2);
  assert.equal(result.missedDays, 5);
  assert.equal(result.totalVisits, 3);
  assert.equal(result.attendancePercentage, 28.6);
});

test("attendance clips eligibility to the selected range and unions overlapping membership periods", () => {
  const result = summariseVoucherAttendance({
    reportFrom: "2026-10-01",
    reportTo: "2026-10-10",
    eligibility: [
      { startDate: "2026-09-15", endDate: "2026-10-05" },
      { startDate: "2026-10-04", endDate: "2026-10-20" },
    ],
    checkins: [],
  });

  assert.equal(result.eligibleDays, 10);
  assert.equal(result.attendedDays, 0);
  assert.equal(result.missedDays, 10);
  assert.equal(result.attendancePercentage, 0);
});

test("visits outside eligible voucher membership days do not count", () => {
  const result = summariseVoucherAttendance({
    reportFrom: "2026-10-01",
    reportTo: "2026-10-10",
    eligibility: [{ startDate: "2026-10-03", endDate: "2026-10-05" }],
    checkins: [
      checkin("1", "m1", "marsa", "Marsa", "2026-10-02T08:00:00Z"),
      checkin("2", "m1", "marsa", "Marsa", "2026-10-03T08:00:00Z"),
      checkin("3", "m1", "sliema", "Sliema", "2026-10-06T08:00:00Z"),
    ],
  });

  assert.equal(result.totalVisits, 1);
  assert.equal(result.attendedDays, 1);
  assert.equal(result.eligibleDays, 3);
  assert.equal(result.missedDays, 2);
});

test("gym breakdown is accurate and sorted by visits descending", () => {
  const result = summariseVoucherAttendance({
    reportFrom: "2026-10-01",
    reportTo: "2026-10-07",
    eligibility: [{ startDate: "2026-10-01", endDate: "2026-10-07" }],
    checkins: [
      checkin("1", "m1", "sliema", "Sliema", "2026-10-01T08:00:00Z"),
      checkin("2", "m1", "marsa", "Marsa", "2026-10-02T08:00:00Z"),
      checkin("3", "m1", "marsa", "Marsa", "2026-10-03T08:00:00Z"),
    ],
  });

  assert.deepEqual(result.gymBreakdown, [
    { gymId: "marsa", gymName: "Marsa", visits: 2 },
    { gymId: "sliema", gymName: "Sliema", visits: 1 },
  ]);
  assert.equal(result.lastVisitAt, "2026-10-03T08:00:00Z");
});

test("attendance status distinguishes no-show from attended members", () => {
  assert.equal(voucherAttendanceStatus({ eligibleDays: 10, attendedDays: 0 }), "no-show");
  assert.equal(voucherAttendanceStatus({ eligibleDays: 10, attendedDays: 1 }), "attended");
  assert.equal(voucherAttendanceStatus({ eligibleDays: 0, attendedDays: 0 }), "not-eligible");
});
