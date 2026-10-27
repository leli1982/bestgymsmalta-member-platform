import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync(new URL("../components/staff/OfflineMembershipSyncBridge.tsx", import.meta.url), "utf8");
const queue = fs.readFileSync(new URL("../lib/offlineMembershipQueue.ts", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/staff/layout.tsx", import.meta.url), "utf8");

test("sync bridge runs on staff app reopen and browser reconnect", () => {
  assert.match(layout, /<OfflineMembershipSyncBridge\s*\/>/);
  assert.match(bridge, /navigator\.onLine/);
  assert.match(bridge, /window\.addEventListener\(["']online["']/);
  assert.match(bridge, /listOfflineMemberships\(\)/);
});

test("queue is processed serially and guarded against overlapping reconnect events", () => {
  assert.match(bridge, /running\.current/);
  assert.match(bridge, /for \(const record of records\)/);
  assert.doesNotMatch(bridge, /Promise\.all\([^)]*record/i);
});

test("401 preserves queued PII and asks staff to sign in", () => {
  assert.match(bridge, /response\.status === 401/);
  assert.match(bridge, /"needs_login"/);
  assert.match(bridge, /Staff login/);
});

test("local PII is removed only after the server confirms a persisted receipt", () => {
  const persistedCheck = bridge.indexOf("payload.persisted !== true");
  const removal = bridge.indexOf("removeOfflineMembership(record.clientSubmissionId)");
  assert.ok(persistedCheck >= 0 && removal > persistedCheck);
  assert.match(bridge, /saveOfflineMembershipSyncReceipt\(receipt\)/);
});

test("IndexedDB keeps lightweight terminal receipts after PII queue deletion", () => {
  assert.match(queue, /const DB_VERSION = 2/);
  assert.match(queue, /sync-receipts/);
  assert.match(queue, /OfflineMembershipSyncReceipt/);
  assert.match(queue, /"needs_attention"/);
  assert.match(queue, /"synced"/);
});
