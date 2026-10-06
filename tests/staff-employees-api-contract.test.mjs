import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paths = {
  employees: "app/api/system/staff-employees/route.ts",
  employee: "app/api/system/staff-employees/[employeeId]/route.ts",
  rate: "app/api/system/staff-employees/[employeeId]/rate/route.ts",
  employmentType: "app/api/system/staff-employees/[employeeId]/employment-type/route.ts",
  holidays: "app/api/system/staff-public-holidays/route.ts",
  holiday: "app/api/system/staff-public-holidays/[holidayId]/route.ts",
};

async function source(path) {
  return readFile(path, "utf8");
}

test("all staff employment and holiday routes are Super Admin only", async () => {
  for (const path of Object.values(paths)) {
    const code = await source(path);
    assert.match(code, /requireSuperAdmin\s*\(/, `${path} must use requireSuperAdmin`);
  }
});

test("employee collection supports list/create but not delete", async () => {
  const code = await source(paths.employees);
  assert.match(code, /export\s+async\s+function\s+GET\s*\(/);
  assert.match(code, /export\s+async\s+function\s+POST\s*\(/);
  assert.doesNotMatch(code, /export\s+async\s+function\s+DELETE\s*\(/);
  assert.match(code, /initialHourlyRateCents/);
  assert.match(code, /rateEffectiveFrom/);
  assert.match(code, /initialEmploymentType/);
  assert.match(code, /employmentTypeEffectiveFrom/);
  assert.match(code, /staff\.employee\.created/);
});

test("employee detail edits profile/status without hard delete", async () => {
  const code = await source(paths.employee);
  assert.match(code, /export\s+async\s+function\s+GET\s*\(/);
  assert.match(code, /export\s+async\s+function\s+PATCH\s*\(/);
  assert.doesNotMatch(code, /export\s+async\s+function\s+DELETE\s*\(/);
  assert.match(code, /staff\.employee\.updated/);
  assert.match(code, /staff\.employee\.status_changed/);
});

test("rate history only inserts effective-dated rows and handles duplicate dates", async () => {
  const code = await source(paths.rate);
  assert.match(code, /effectiveFrom/);
  assert.match(code, /bgm_staff_rate_history/);
  assert.match(code, /\.insert\s*\(/);
  assert.doesNotMatch(code, /bgm_staff_rate_history[\s\S]{0,800}\.update\s*\(/);
  assert.match(code, /409/);
  assert.match(code, /staff\.rate\.added/);
});

test("employment type history only inserts effective-dated rows and handles duplicate dates", async () => {
  const code = await source(paths.employmentType);
  assert.match(code, /effectiveFrom/);
  assert.match(code, /bgm_staff_employment_type_history/);
  assert.match(code, /\.insert\s*\(/);
  assert.doesNotMatch(code, /bgm_staff_employment_type_history[\s\S]{0,800}\.update\s*\(/);
  assert.match(code, /409/);
  assert.match(code, /staff\.employment_type\.added/);
});

test("public holiday create and versioning preserve historical versions", async () => {
  const collection = await source(paths.holidays);
  const detail = await source(paths.holiday);

  assert.match(collection, /bgm_staff_public_holidays/);
  assert.match(collection, /bgm_staff_public_holiday_versions/);
  assert.match(collection, /staff\.holiday\.created/);

  assert.match(detail, /export\s+async\s+function\s+PATCH\s*\(/);
  assert.match(detail, /bgm_staff_public_holiday_versions/);
  assert.match(detail, /\.insert\s*\(/);
  assert.match(detail, /superseded_at/);
  assert.match(detail, /staff\.holiday\.versioned/);
});
