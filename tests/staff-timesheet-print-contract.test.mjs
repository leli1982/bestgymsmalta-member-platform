import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(path, "utf8").catch(() => ""); }

test("timesheet print surface is Super Admin aware, A4, European dated and salary-toggle safe", async () => {
  const page = await source("app/staff/admin/staff/timesheets/print/page.tsx");
  const component = await source("components/staff/StaffTimesheetPrint.tsx");
  assert.match(page, /StaffTimesheetPrint/);
  assert.match(component, /A4/);
  assert.match(component, /BestGymsMalta/);
  assert.match(component, /DD\/MM\/YYYY|formatEuropeanDate/);
  assert.match(component, /includeSalary/);
  assert.match(component, /page-break|break-after|break-before/i);
  assert.match(component, /window\.print/);
});

test("salary values are conditionally omitted rather than CSS-hidden", async () => {
  const component = await source("components/staff/StaffTimesheetPrint.tsx");
  assert.match(component, /includeSalary\s*&&/);
  assert.doesNotMatch(component, /visibility:\s*hidden|display:\s*none[^\n]*salary/i);
});
