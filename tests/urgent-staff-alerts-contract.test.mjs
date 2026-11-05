import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = path => readFileSync(join(root, path), "utf8");
const admin = read("app/api/system/admin/urgent-staff-alerts/route.ts");
const staff = read("app/api/system/staff/urgent-alerts/route.ts");
const realtime = read("lib/urgentStaffAlertsRealtime.ts");
const rtRoute = read("app/api/system/staff/urgent-alerts/realtime/route.ts");
const overlay = read("components/staff/UrgentStaffAlertOverlay.tsx");
const layout = read("app/staff/layout.tsx");
const scanner = read("components/staff/StaffGlobalScanner.tsx");
const migration = read("supabase/migrations/20261105_123500_urgent_staff_alerts.sql");

test("internal alert entry point only mounts within Staff Portal", () => {
  assert.match(layout, /<UrgentStaffAlertOverlay\s*\/>/);
  assert.doesNotMatch(read("app/layout.tsx"), /UrgentStaffAlertOverlay/);
  assert.doesNotMatch(read("app/page.tsx"), /UrgentStaffAlertOverlay/);
});

test("Super Admin only can create and cancel alerts", () => {
  assert.match(admin, /requireSuperAdmin\(request\)/);
  assert.match(admin, /bgm_create_urgent_staff_alert/);
  assert.match(admin, /bgm_cancel_urgent_staff_alert/);
  assert.match(admin, /notifyRecipients/);
});

test("staff pending and acknowledgment are server-scoped to session gym", () => {
  assert.match(staff, /getSystemContext\(request\)/);
  assert.match(staff, /context\.role !== "gym_staff"/);
  assert.match(staff, /context\.gymId/);
  assert.match(staff, /bgm_acknowledge_urgent_staff_alert/);
  assert.doesNotMatch(staff, /body\.gymId|searchParams\.get\(["']gym/i);
});

test("notice remains mounted below original scanner modal, with only saved ACK closing it", () => {
  assert.match(overlay, /z-\[950\]/);
  assert.match(scanner, /z-\[1000\]/);
  assert.match(scanner, /z-\[1001\]/);
  assert.match(overlay, /setReadBy\(""\)/);
  assert.match(overlay, /await load\(\)/);
  assert.match(overlay, /readBy\.trim\(\)/);
  assert.doesNotMatch(overlay, /setAlerts\(\[\]\).*acknowledge|onClick.*close/i);
});

test("alerts persist in dedicated tables with explicit service-only access", () => {
  assert.match(migration, /create table if not exists public\.bgm_urgent_staff_alerts/);
  assert.match(migration, /create table if not exists public\.bgm_urgent_staff_alert_recipients/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on public\.bgm_urgent_staff_alerts from public, anon, authenticated/);
  assert.match(migration, /bgm_acknowledge_urgent_staff_alert/);
  assert.match(migration, /bgm_audit_log/);
  assert.doesNotMatch(migration, /(?:alter|update|delete)\s+(?:table\s+)?(?:public\.)?bgm_members\b/i);
});

test("Realtime delivers only refresh signals and has polling fallback", () => {
  assert.match(realtime, /createHmac/);
  assert.match(realtime, /refresh: true/);
  assert.match(rtRoute, /context\.role !== "gym_staff"/);
  assert.match(overlay, /setInterval\(refresh, 15000\)/);
  assert.doesNotMatch(realtime, /subject|message|read_by|memberNumber/);
});

test("Super Admin gets a separate alert screen; members announcement remains distinct", () => {
  const home = read("components/staff/SuperAdminHome.tsx");
  assert.match(home, /\/staff\/admin\/urgent-staff-alerts/);
  assert.match(home, /\/staff\/admin\/announcements/);
  assert.match(read("app/api/system/admin/announcements/route.ts"), /bgm_announcements/);
});
