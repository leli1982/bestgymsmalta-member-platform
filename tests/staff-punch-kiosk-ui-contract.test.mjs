import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  staff: "components/staff/StaffEmployeesAdmin.tsx",
  terminals: "components/staff/StaffTerminalsAdmin.tsx",
  kiosk: "components/staff/StaffPunchClockKiosk.tsx",
  page: "app/staff/punch-clock/page.tsx",
};

async function source(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("Staff management renders the real Punch Clock Terminals panel", async () => {
  const staff = await source(files.staff);
  assert.match(staff, /StaffTerminalsAdmin/);
  assert.match(staff, /area\s*===\s*["']Punch Clock Terminals["']/);
  assert.doesNotMatch(staff, /Punch Clock Terminals[^\n]+<Coming/);
});

test("terminal admin exposes identity, gym, status, last seen and hardware state", async () => {
  const terminals = await source(files.terminals);
  assert.match(terminals, /Punch Clock Terminals/);
  assert.match(terminals, /Terminal name|Name/);
  assert.match(terminals, /Gym/);
  assert.match(terminals, /Active|Inactive/);
  assert.match(terminals, /Last seen/);
  assert.match(terminals, /Hardware/);
  assert.match(terminals, /Not connected|Not configured/);
  assert.match(terminals, /\/api\/system\/staff-terminals/);
});

test("terminal provisioning clearly targets this browser/device and requires deliberate confirmation", async () => {
  const terminals = await source(files.terminals);
  assert.match(terminals, /Provision this (?:browser|device)/i);
  assert.match(terminals, /Rotate|Re-provision/i);
  assert.match(terminals, /confirm\(/i);
  assert.match(terminals, /\/provision/);
  assert.match(terminals, /one-time|protected cookie|this browser/i);
});

test("Punch Clock page renders only the kiosk shell", async () => {
  const page = await source(files.page);
  assert.match(page, /StaffPunchClockKiosk/);
  assert.doesNotMatch(page, /StaffEmployeesAdmin|Timesheets|Hourly rate|Payroll/i);
});

test("kiosk shows terminal gym, current clock and explicit hardware/waiting states", async () => {
  const kiosk = await source(files.kiosk);
  assert.match(kiosk, /\/api\/staff-punch-clock\/session/);
  assert.match(kiosk, /gym/i);
  assert.match(kiosk, /current|clock|time/i);
  assert.match(kiosk, /hardware_not_configured|Fingerprint reader is not configured/i);
  assert.match(kiosk, /waiting/i);
  assert.match(kiosk, /processing/i);
});

test("kiosk supports safe confirmation/error states without exposing payroll or employee selection", async () => {
  const kiosk = await source(files.kiosk);
  for (const state of ["CLOCKED IN", "CLOCKED OUT", "duplicate", "inactive", "needs attention"]) {
    assert.match(kiosk.toLowerCase(), new RegExp(state.toLowerCase()));
  }
  assert.match(kiosk, /firstName|surname/);
  assert.match(kiosk, /photoUrl/);
  assert.match(kiosk, /dailyMinutes/);
  assert.doesNotMatch(kiosk, /hourly rate|salary|payCents|pay_cents|payroll/i);
  assert.doesNotMatch(kiosk, /employee selector|choose employee|select employee|employee dropdown/i);
});

test("successful kiosk confirmations reset automatically while errors remain readable", async () => {
  const kiosk = await source(files.kiosk);
  assert.match(kiosk, /setTimeout/);
  assert.match(kiosk, /clocked_in|clocked_out/);
  assert.match(kiosk, /retry|Try again/i);
});
