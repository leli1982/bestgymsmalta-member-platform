import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("live gym monitor API is Super Admin-only, gym-scoped and read-only", () => {
  const api = read("app/api/system/live-gym-monitor/route.ts");
  assert.match(api, /requireSuperAdmin\(request\)/);
  assert.match(api, /searchParams\.get\(["']gymId["']\)/);
  assert.match(api, /bgm_access_scans/);
  assert.match(api, /bgm_member_checkins/);
  assert.match(api, /bgm_audit_trail_read/);
  assert.match(api, /bgm_operational_orders/);
  assert.match(api, /private, no-store/);
  assert.doesNotMatch(api, /card_uid/);
  assert.doesNotMatch(api, /credential_value/);
});

test("live gym monitor UI is reachable from Super Admin and polls every five seconds", () => {
  const home = read("components/staff/SuperAdminHome.tsx");
  const page = read("app/staff/admin/live-monitor/page.tsx");
  const ui = read("components/staff/LiveGymMonitorAdmin.tsx");
  assert.match(home, /\/staff\/admin\/live-monitor/);
  assert.match(home, /Live Gym Monitor/);
  assert.match(page, /LiveGymMonitorAdmin/);
  assert.match(ui, /5000/);
  assert.match(ui, /Check-ins today/);
  assert.match(ui, /Rejected scans/);
  assert.match(ui, /Bar total/);
  assert.match(ui, /Recent activity/);
  assert.match(ui, /Refresh/);
});
