import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/system/staff-public-holidays/[holidayId]/route.ts", "utf8");
const ui = fs.readFileSync("components/staff/StaffPublicHolidaysAdmin.tsx", "utf8");

test("public holidays expose guarded delete while preserving payroll history", () => {
  assert.match(route, /export async function DELETE/);
  assert.match(route, /bgm_staff_session_payroll_segments/);
  assert.match(route, /cannot be deleted because it is already used in payroll history/i);
  assert.match(ui, /Delete holiday/);
  assert.match(ui, /method:\s*"DELETE"/);
});
