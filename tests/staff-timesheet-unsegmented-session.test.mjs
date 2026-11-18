import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("lib/staffTimesheetReport.ts", "utf8");

test("timesheets retain real OUT timestamps and gyms when a closed attendance session lacks payroll segments", () => {
  const marker = "for (const session of input.sessions) {";
  const start = source.indexOf(marker);
  const end = source.indexOf("const sortedDays", start);
  assert.ok(start >= 0 && end > start, "Expected unsegmented attendance allocation fallback");
  const fallback = source.slice(start, end);
  assert.match(fallback, /id: `unsegmented:\$\{session\.id\}`/);
  assert.match(fallback, /clockOutAt: session\.clockOutAt/);
  assert.match(fallback, /clockOutGymName: session\.clockOutGymName/);
  assert.doesNotMatch(fallback, /clockOutAt: null/);
  assert.doesNotMatch(fallback, /clockOutGymName: null/);
});

test("unsegmented attendance can be closed without inventing payroll or marking it OPEN", () => {
  assert.match(source, /export type StaffTimesheetUnsegmentedAllocation/);
  assert.match(source, /clockOutAt: string \| null/);
  assert.match(source, /clockOutGymName: string \| null/);
  assert.match(source, /workedMinutes: null;[\s\S]*?payCents: null;/);
  assert.match(source, /clockOutAt: session\.clockOutAt/);
  assert.match(source, /clockOutGymName: session\.clockOutGymName/);
});
