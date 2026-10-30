import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../components/staff/OfflineResilienceBridge.tsx", import.meta.url), "utf8");
const barWarmup = fs.readFileSync(new URL("../components/staff/BarOfflineWarmupBridge.tsx", import.meta.url), "utf8");
const enrollmentWarmup = fs.readFileSync(new URL("../components/staff/EnrollmentOfflineWarmupBridge.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../components/staff/StaffLoginPage.tsx", import.meta.url), "utf8");
const roster = fs.readFileSync(new URL("../components/staff/OfflineRosterPage.tsx", import.meta.url), "utf8");
const scanner = fs.readFileSync(new URL("../components/staff/StaffGlobalScanner.tsx", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../public/staff-sw.js", import.meta.url), "utf8");
const rosterRoute = fs.readFileSync(new URL("../app/api/system/offline-roster/route.ts", import.meta.url), "utf8");

test("staff shell mounts offline resilience bridges", () => {
  assert.match(layout, /OfflineResilienceBridge/);
  assert.match(layout, /<OfflineResilienceBridge\s*\/>/);
  assert.match(layout, /BarOfflineWarmupBridge/);
  assert.match(layout, /<BarOfflineWarmupBridge\s*\/>/);
  assert.match(layout, /EnrollmentOfflineWarmupBridge/);
  assert.match(layout, /<EnrollmentOfflineWarmupBridge\s*\/>/);
});

test("pending Bar sales survive restart and retry safely", () => {
  assert.match(bridge, /bgm-bar-pending:/);
  assert.match(bridge, /localStorage\.getItem/);
  assert.match(bridge, /\/api\/system\/auth/);
  assert.match(bridge, /\/api\/system\/bar\/today/);
  assert.match(bridge, /method:\s*"PUT"/);
  assert.match(bridge, /response\.ok/);
  assert.match(bridge, /localStorage\.removeItem/);
  assert.match(bridge, /context\.businessDate\s*!==\s*today/);
  assert.match(bridge, /data\?\.locked/);
  assert.match(bridge, /local copy was kept/);
});

test("offline roster refreshes on startup, login and reconnect", () => {
  assert.match(bridge, /syncOfflineRoster/);
  assert.match(bridge, /addEventListener\("online"/);
  assert.match(bridge, /bgm-staff-auth-changed/);
  assert.match(bridge, /setInterval\(\(\) => void syncRosterBestEffort/);
  assert.match(bridge, /href="\/staff\/offline"/);
  assert.match(bridge, /OFFLINE · Member Lookup/);
  assert.match(roster, /Save Offline Roster Now/);
  assert.match(roster, /syncAndShow\(\{ quiet: true \}\)/);
});

test("offline roster API fetches every Supabase page", () => {
  assert.match(rosterRoute, /const PAGE_SIZE = 1000/);
  assert.match(rosterRoute, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(rosterRoute, /if \(page\.length < PAGE_SIZE\) break/);
  assert.match(rosterRoute, /fetchAllActiveMembers/);
  assert.match(rosterRoute, /fetchAllModernCards/);
  assert.match(rosterRoute, /fetchAllLegacyCards/);
});

test("main Staff shell registers service worker before an outage", () => {
  assert.match(bridge, /registerStaffServiceWorker/);
  assert.match(bridge, /void registerStaffServiceWorker\(\)/);
});

test("recent non-admin staff session survives a hard refresh while offline", () => {
  assert.match(login, /bgmStaffOfflineSessionV1/);
  assert.match(login, /24 \* 60 \* 60 \* 1000/);
  assert.match(login, /saveOfflineSession\(sessionUser/);
  assert.match(login, /loadOfflineSession/);
  assert.match(login, /setOfflineMode\(true\)/);
  assert.match(login, /OFFLINE MODE/);
  assert.match(login, /Emergency Member Lookup/);
  assert.match(login, /New Member/);
  assert.match(login, /Bar/);
  assert.match(login, /clearOfflineSession\(\)/);
  assert.match(login, /user\.isSuperAdmin \|\| user\.role === "super_admin"/);
});

test("Staff landing page prefers offline mode before cached API auth can mask an outage", () => {
  const offlineGuard = login.indexOf("if (typeof navigator !== \"undefined\" && !navigator.onLine)");
  const authFetch = login.indexOf('fetch("/api/system/auth", { cache: "no-store" })');
  assert.notEqual(offlineGuard, -1);
  assert.notEqual(authFetch, -1);
  assert.ok(offlineGuard < authFetch);
  assert.match(login, /const cached = loadOfflineSession\(expectedGym\?\.id \|\| null\)/);
  assert.match(login, /setOfflineMode\(true\)/);
});

test("staff service worker precaches outage-safe routes and Bar APIs", () => {
  assert.match(serviceWorker, /bgm-staff-shell-v6/);
  assert.match(serviceWorker, /"\/staff\/offline"/);
  assert.match(serviceWorker, /"\/staff\/members\/enroll"/);
  assert.match(serviceWorker, /"\/staff\/bar"/);
  assert.match(serviceWorker, /\/api\/system\/bar\/catalog/);
  assert.match(serviceWorker, /\/api\/system\/bar\/today/);
  assert.match(serviceWorker, /\/api\/gyms/);
  assert.match(serviceWorker, /AUTH_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(serviceWorker, /payload\.user\.isSuperAdmin/);
  assert.match(serviceWorker, /payload\.user\.role === "super_admin"/);
});

test("Bar cache is warmed during ordinary Staff use", () => {
  assert.match(barWarmup, /\/api\/system\/auth/);
  assert.match(barWarmup, /\/api\/gyms/);
  assert.match(barWarmup, /\/api\/system\/bar\/catalog/);
  assert.match(barWarmup, /\/api\/system\/bar\/today\?gymId=/);
  assert.match(barWarmup, /navigator\.serviceWorker\.ready/);
  assert.match(barWarmup, /bgm-staff-auth-changed/);
  assert.match(barWarmup, /addEventListener\("online"/);
});

test("New Member enrollment context and all route assets are warmed during ordinary Staff use", () => {
  assert.match(enrollmentWarmup, /navigator\.serviceWorker\.ready/);
  assert.match(enrollmentWarmup, /fetch\("\/staff\/members\/enroll\?kind=new"/);
  assert.match(enrollmentWarmup, /\/_next\/static\//);
  assert.match(enrollmentWarmup, /Promise\.allSettled/);
  assert.match(enrollmentWarmup, /\/api\/system\/members\/registration/);
  assert.match(enrollmentWarmup, /cacheOfflineEnrollmentContext/);
  assert.match(enrollmentWarmup, /payload\.config/);
  assert.match(enrollmentWarmup, /payload\.systemUser/);
  assert.match(enrollmentWarmup, /bgm-staff-auth-changed/);
  assert.match(enrollmentWarmup, /addEventListener\("online"/);
  assert.match(enrollmentWarmup, /setInterval/);
});

test("Emergency Member Lookup is only floated during an outage", () => {
  assert.match(scanner, /fixed bottom-4 left-4/);
  assert.match(bridge, /!hideLookup && !online/);
  assert.match(bridge, /OFFLINE · Member Lookup/);
});
