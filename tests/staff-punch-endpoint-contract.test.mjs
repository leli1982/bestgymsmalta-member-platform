import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  adapter: "lib/staffBiometricAdapter.ts",
  route: "app/api/staff-punch-clock/punch/route.ts",
};

async function source(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("biometric adapter boundary exposes only a trusted match and is disabled until hardware is configured", async () => {
  const adapter = await source(files.adapter);
  assert.match(adapter, /export type BiometricMatch/);
  assert.match(adapter, /employeeId:\s*string/);
  assert.match(adapter, /adapterEventId:\s*string/);
  assert.match(adapter, /matchedAt:\s*string/);
  assert.match(adapter, /export interface StaffBiometricAdapter/);
  assert.match(adapter, /resolveMatch\(input:\s*unknown\)/);
  assert.match(adapter, /hardware_not_configured/);
  assert.doesNotMatch(adapter, /employee dropdown|employee selector/i);
});

test("punch endpoint authenticates the terminal before resolving biometric identity", async () => {
  const route = await source(files.route);
  assert.match(route, /requireStaffTerminal\(request\)/);
  assert.match(route, /resolveMatch/);
  assert.match(route, /recordStaffPunch/);
  assert.match(route, /auth\.context\.terminalId/);
  assert.doesNotMatch(route, /searchParams\.get\(["']employee/i);
  assert.doesNotMatch(route, /body\??\.employeeId|body\.employeeId/);
});

test("terminal gym remains server-resolved and is not accepted from kiosk request body", async () => {
  const route = await source(files.route);
  assert.match(route, /auth\.context\.gymId/);
  assert.doesNotMatch(route, /body\??\.gymId|body\.gymId/);
  assert.doesNotMatch(route, /searchParams\.get\(["']gymId["']\)/);
});

test("punch endpoint emits only kiosk-safe confirmation fields", async () => {
  const route = await source(files.route);
  assert.match(route, /firstName/);
  assert.match(route, /surname/);
  assert.match(route, /photoUrl/);
  assert.match(route, /outcome/);
  assert.match(route, /gym/);
  assert.match(route, /effectiveAt/);
  assert.match(route, /dailyMinutes/);
  assert.doesNotMatch(route, /hourly_rate|hourlyRate|pay_cents|payCents|salary|rate_history|employment_history/i);
});

test("hardware and identity failures map to safe kiosk messages", async () => {
  const route = await source(files.route);
  assert.match(route, /hardware_not_configured/);
  assert.match(route, /inactive_employee/);
  assert.match(route, /inactive_terminal/);
  assert.match(route, /duplicate_ignored/);
  assert.doesNotMatch(route, /credential_hash|service_role|database error/i);
});
