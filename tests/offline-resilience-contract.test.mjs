import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../components/staff/OfflineResilienceBridge.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");

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
});
