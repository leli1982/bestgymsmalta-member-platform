import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(path, "utf8").catch(() => ""); }

test("timesheet UI exposes print, Excel and individualized email actions with salary toggle", async () => {
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(component, /Print \/ Save PDF/);
  assert.match(component, /Export Excel/);
  assert.match(component, /Email selected/);
  assert.match(component, /Email all filtered/);
  assert.match(component, /include salary|salary/i);
  assert.match(component, /missing email/i);
  assert.match(component, /sent|skipped|failed/i);
});

test("batch timesheet email requires an explicit filtered-recipient confirmation", async () => {
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.match(component, /window\.confirm/);
  assert.match(component, /individual email/i);
  assert.match(component, /missing email/i);
  assert.match(component, /reports\.length/);
});

test("manual punch and session correction use proper form modals instead of browser prompts", async () => {
  const component = await source("components/staff/StaffTimesheetsAdmin.tsx");
  assert.doesNotMatch(component, /window\.prompt/);
  assert.match(component, /Manual Punch/);
  assert.match(component, /Correct Session/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /Punch date/);
  assert.match(component, /Punch time/);
  assert.match(component, /Gym/);
  assert.match(component, /Reason/);
  assert.match(component, /Correct IN date/);
  assert.match(component, /Correct IN time/);
  assert.match(component, /Correct OUT date/);
  assert.match(component, /Correct OUT time/);
  assert.match(component, /reviewMidnight/);
});

test("employee Audit tab shows attendance adjustments and central audit data", async () => {
  const detail = await source("components/staff/StaffEmployeeDetail.tsx");
  assert.match(detail, /attendance adjustments|bgm_staff_attendance_adjustments|adjustments/i);
  assert.match(detail, /Audit Trail|audit/i);
  assert.match(detail, /reason/i);
});
