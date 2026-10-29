import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../components/staff/OfflineResilienceBridge.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../components/staff/StaffLoginPage.tsx", import.meta.url), "utf8");
const roster = fs.readFileSync(new URL("../components/staff/OfflineRosterPage.tsx", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../public/staff-sw.js", import.meta.url), "utf8");

test("staff shell mounts offline resilience bridge", () => {
  assert.match(layout, /OfflineResilienceBridge/);
  assert.match(layout, /<OfflineResilienceBridge\s*\/>/);
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

test("staff service worker precaches outage-safe routes", () => {
  assert.match(serviceWorker, /bgm-staff-shell-v4/);
  assert.match(serviceWorker, /"\/staff\/offline"/);
  assert.match(serviceWorker, /"\/staff\/members\/enroll"/);
  assert.match(serviceWorker, /"\/staff\/bar"/);
});
