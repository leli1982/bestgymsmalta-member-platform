import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePayCents,
  effectiveRecordOn,
  holidayMultiplierBps,
  normalizePunchMinute,
} from "../lib/staffAttendanceCore.ts";

test("effectiveRecordOn resolves the latest row effective on or before the date", () => {
  const rows = [
    { id: "later", effectiveFrom: "2026-11-01", hourlyRateCents: 1000 },
    { id: "initial", effectiveFrom: "2026-01-01", hourlyRateCents: 850 },
    { id: "change", effectiveFrom: "2026-06-15", hourlyRateCents: 900 },
  ];

  assert.equal(effectiveRecordOn(rows, "2025-12-31"), null);
  assert.equal(effectiveRecordOn(rows, "2026-01-01")?.id, "initial");
  assert.equal(effectiveRecordOn(rows, "2026-06-14")?.id, "initial");
  assert.equal(effectiveRecordOn(rows, "2026-06-15")?.id, "change");
  assert.equal(effectiveRecordOn(rows, "2026-10-31")?.id, "change");
  assert.equal(effectiveRecordOn(rows, "2026-11-01")?.id, "later");
  assert.deepEqual(rows.map((row) => row.id), ["later", "initial", "change"]);
});

test("effectiveRecordOn resolves Part Time to Full Time changes by effective date", () => {
  const rows = [
    { id: "pt", effectiveFrom: "2026-01-01", employmentType: "part_time" },
    { id: "ft", effectiveFrom: "2026-09-01", employmentType: "full_time" },
  ];

  assert.equal(effectiveRecordOn(rows, "2026-08-31")?.employmentType, "part_time");
  assert.equal(effectiveRecordOn(rows, "2026-09-01")?.employmentType, "full_time");
});

test("holiday multiplier selects the employment-type value and normal days use 1.0x", () => {
  const holiday = {
    id: "holiday-v1",
    holidayDate: "2026-12-25",
    active: true,
    fullTimeMultiplierBps: 20000,
    partTimeMultiplierBps: 15000,
  };

  assert.equal(holidayMultiplierBps(holiday, "full_time"), 20000);
  assert.equal(holidayMultiplierBps(holiday, "part_time"), 15000);
  assert.equal(holidayMultiplierBps(null, "full_time"), 10000);
  assert.equal(holidayMultiplierBps(null, "part_time"), 10000);
});

test("normalizePunchMinute truncates only seconds and milliseconds", () => {
  const source = new Date("2026-10-06T08:23:59.987Z");
  const normalized = normalizePunchMinute(source);

  assert.equal(normalized.toISOString(), "2026-10-06T08:23:00.000Z");
  assert.equal(source.toISOString(), "2026-10-06T08:23:59.987Z");
});

test("pay calculation uses minute precision and rounds only to the nearest euro cent", () => {
  assert.equal(calculatePayCents(60, 850, 10000), 850);
  assert.equal(calculatePayCents(30, 850, 20000), 850);
  assert.equal(calculatePayCents(1, 1000, 10000), 17);
  assert.equal(calculatePayCents(7, 1375, 15000), 241);
});

test("pay helpers reject negative or non-integer persisted payroll inputs", () => {
  assert.throws(() => calculatePayCents(-1, 850, 10000), /minutes/i);
  assert.throws(() => calculatePayCents(60, -1, 10000), /rate/i);
  assert.throws(() => calculatePayCents(60, 850, 0), /multiplier/i);
  assert.throws(() => calculatePayCents(1.5, 850, 10000), /minutes/i);
});
