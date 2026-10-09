import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const engineUrl = new URL("../lib/googleWalletSyncEngine.ts", import.meta.url);
const cronUrl = new URL("../app/api/cron/membership-expiry-reminders/route.ts", import.meta.url);
const engine = fs.existsSync(engineUrl) ? fs.readFileSync(engineUrl, "utf8") : "";
const cron = fs.readFileSync(cronUrl, "utf8");

test("Wallet recovery engine is bounded to pending/failed provisioned mappings in oldest-first order", () => {
  assert.equal(fs.existsSync(engineUrl), true, "Wallet recovery engine must exist");
  assert.match(engine, /export async function runGoogleWalletRecoverySync/);
  assert.match(engine, /pageSize\s*=\s*25/);
  assert.match(engine, /Math\.min\(50,/);
  assert.match(engine, /Math\.max\(1,/);
  assert.match(engine, /\.from\("bgm_google_wallet_passes"\)/);
  assert.match(engine, /\.select\("member_id,sync_status,updated_at"\)/);
  assert.match(engine, /\.in\("sync_status",\s*\["pending",\s*"failed"\]\)/);
  assert.match(engine, /\.order\("updated_at",\s*\{\s*ascending:\s*true\s*\}\)/);
  assert.match(engine, /\.limit\(limit\)|\.range\(0,\s*limit\s*-\s*1\)/);
});

test("Wallet recovery never provisions and isolates one member failure from the rest", () => {
  assert.match(engine, /syncGoogleWalletPassForMember\(row\.member_id,\s*\{\s*provision:\s*false\s*\}\)/);
  assert.doesNotMatch(engine, /provision:\s*true/);

  const loopIndex = engine.indexOf("for (const row of");
  const syncIndex = engine.indexOf("syncGoogleWalletPassForMember", loopIndex);
  const catchIndex = engine.indexOf("catch", syncIndex);
  assert.ok(loopIndex >= 0, "recovery must process selected mappings individually");
  assert.ok(syncIndex > loopIndex, "each selected mapping must be synchronized");
  assert.ok(catchIndex > syncIndex, "per-member sync failures must be caught inside the processing loop");
});

test("Wallet recovery returns examined, synced, failed and skipped counters", () => {
  assert.match(engine, /examined:\s*0/);
  assert.match(engine, /synced:\s*0/);
  assert.match(engine, /failed:\s*0/);
  assert.match(engine, /skipped:\s*0/);
  assert.match(engine, /summary\.examined\s*\+=\s*1/);
  assert.match(engine, /summary\.synced\s*\+=\s*1/);
  assert.match(engine, /summary\.failed\s*\+=\s*1/);
  assert.match(engine, /summary\.skipped\s*\+=\s*1/);
});

test("secured daily cron runs Wallet recovery independently beside expiry and engagement engines", () => {
  assert.match(cron, /runGoogleWalletRecoverySync/);
  assert.match(cron, /googleWalletSync/);
  assert.match(cron, /runEngine\("Google Wallet sync",\s*\(\)\s*=>\s*runGoogleWalletRecoverySync\(\)\)/);
  assert.match(cron, /Promise\.all/);
  assert.match(cron, /membershipReminders\.ok\s*&&\s*memberEngagement\.ok\s*&&\s*googleWalletSync\.ok/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /maxDuration\s*=\s*60/);
});
