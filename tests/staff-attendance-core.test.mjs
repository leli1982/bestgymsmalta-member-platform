import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePayCents,
  effectiveRecordOn,
  holidayMultiplierBps,
  normalizePunchMinute,
  splitSessionByMaltaDate,
  workedMinutes,
} from "../lib/staffAttendanceCore.ts";
import { maltaDayUtcRange } from "../lib/maltaDate.ts";

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

test("workedMinutes calculates exact elapsed whole minutes", () => {
  assert.equal(
    workedMinutes(new Date("2026-10-06T06:00:00.000Z"), new Date("2026-10-06T10:00:00.000Z")),
    240,
  );
  assert.throws(
    () => workedMinutes(new Date("2026-10-06T10:00:00.000Z"), new Date("2026-10-06T09:59:00.000Z")),
    /before/i,
  );
  assert.throws(
    () => workedMinutes(new Date("2026-10-06T06:00:30.000Z"), new Date("2026-10-06T10:00:00.000Z")),
    /whole minute/i,
  );
});

test("same-day Malta session produces one slice", () => {
  const slices = splitSessionByMaltaDate(
    new Date("2026-10-06T06:00:00.000Z"),
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.equal(slices.length, 1);
  assert.equal(slices[0].calendarDate, "2026-10-06");
  assert.equal(slices[0].workedMinutes, 240);
});

test("22:00 to 06:00 Malta splits across midnight into 120 and 360 minutes", () => {
  const slices = splitSessionByMaltaDate(
    new Date("2026-10-06T20:00:00.000Z"),
    new Date("2026-10-07T04:00:00.000Z"),
  );

  assert.deepEqual(
    slices.map((slice) => [slice.calendarDate, slice.workedMinutes]),
    [
      ["2026-10-06", 120],
      ["2026-10-07", 360],
    ],
  );
});

test("holiday-date allocation can change exactly at Malta midnight", () => {
  const slices = splitSessionByMaltaDate(
    new Date("2026-12-24T21:00:00.000Z"),
    new Date("2026-12-25T02:00:00.000Z"),
  );

  assert.deepEqual(
    slices.map((slice) => [slice.calendarDate, slice.workedMinutes]),
    [
      ["2026-12-24", 120],
      ["2026-12-25", 180],
    ],
  );
});

test("Malta DST spring day uses 23 actual elapsed hours", () => {
  const range = maltaDayUtcRange("2026-03-29");
  const slices = splitSessionByMaltaDate(new Date(range.start), new Date(range.end));

  assert.equal(slices.length, 1);
  assert.equal(slices[0].calendarDate, "2026-03-29");
  assert.equal(slices[0].workedMinutes, 23 * 60);
});

test("Malta DST autumn day uses 25 actual elapsed hours", () => {
  const range = maltaDayUtcRange("2026-10-25");
  const slices = splitSessionByMaltaDate(new Date(range.start), new Date(range.end));

  assert.equal(slices.length, 1);
  assert.equal(slices[0].calendarDate, "2026-10-25");
  assert.equal(slices[0].workedMinutes, 25 * 60);
});
