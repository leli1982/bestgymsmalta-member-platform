import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/staffAttendanceMaltaTime.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(output, { module, exports: module.exports, Date, Intl, Error });
const { maltaAttendanceWallTimeToIso: toIso } = module.exports;

test("manual punch times use Malta winter and summer offsets", () => {
  assert.equal(toIso("2026-01-15", "09:30"), "2026-01-15T08:30:00.000Z");
  assert.equal(toIso("2026-07-15", "09:30"), "2026-07-15T07:30:00.000Z");
});

test("spring-forward missing hour fails closed", () => {
  assert.throws(() => toIso("2026-03-29", "02:30"), /does not exist/);
  assert.equal(toIso("2026-03-29", "03:15"), "2026-03-29T01:15:00.000Z");
});

test("autumn repeated hour fails closed instead of guessing payroll time", () => {
  assert.throws(() => toIso("2026-10-25", "02:30"), /occurs twice/);
  assert.equal(toIso("2026-10-25", "03:15"), "2026-10-25T02:15:00.000Z");
});

test("invalid calendar dates and clock values cannot create attendance", () => {
  assert.throws(() => toIso("2026-02-30", "09:00"), /calendar date/);
  assert.throws(() => toIso("2026-01-15", "25:61"), /valid Malta attendance/);
  assert.equal(toIso("2028-02-29", "12:00"), "2028-02-29T11:00:00.000Z");
});

test("both Super Admin attendance edits use explicit Malta conversion", () => {
  const component = readFileSync(new URL("../components/staff/StaffTimesheetsAdmin.tsx", import.meta.url), "utf8");
  assert.ok(component.includes('import { maltaAttendanceWallTimeToIso } from "@/lib/staffAttendanceMaltaTime"'));
  assert.ok((component.match(/maltaAttendanceWallTimeToIso\(/g) || []).length >= 3);
  assert.ok(!component.includes('new Date(`${date}T${time}:00`)'));
});
