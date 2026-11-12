import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  hu20TestEnabled,
  issueHu20TerminalSecret,
  verifyHu20TerminalSecret,
  validHu20TerminalId,
} from "../lib/hu20TerminalSecurity.ts";

const testUrl = "https://vlvyqdjhzdcxatilbdiv.supabase.co";
const prodUrl = "https://jsuolemirhivqhjbjetv.supabase.co";
const preview = {
  BGM_HU20_TEST_ENABLED: "true", VERCEL_ENV: "preview",
  SUPABASE_URL: testUrl, NEXT_PUBLIC_SUPABASE_URL: testUrl,
};
test("HU20 experimental endpoints are hard-locked to TEST", () => {
  assert.equal(hu20TestEnabled(preview), true);
  assert.equal(hu20TestEnabled({ ...preview, VERCEL_ENV: "production" }), false);
  assert.equal(hu20TestEnabled({ ...preview, SUPABASE_URL: prodUrl }), false);
  assert.equal(hu20TestEnabled({ ...preview, NEXT_PUBLIC_SUPABASE_URL: prodUrl }), false);
  assert.equal(hu20TestEnabled({ ...preview, BGM_HU20_TEST_ENABLED: "false" }), false);
  assert.equal(hu20TestEnabled({ ...preview, VERCEL_ENV: undefined, NODE_ENV: "production" }), false);
  assert.equal(hu20TestEnabled({ ...preview, VERCEL_ENV: undefined, NODE_ENV: "development" }), true);
});
test("terminal credentials are unpredictable, hashed and checked", () => {
  const a = issueHu20TerminalSecret();
  const b = issueHu20TerminalSecret();
  assert.match(a.secret, /^[a-f0-9]{64}$/);
  assert.match(a.credentialHash, /^sha256:v1:[a-f0-9]{64}$/);
  assert.notEqual(a.secret, b.secret);
  assert.notEqual(a.secret, a.credentialHash);
  assert.equal(verifyHu20TerminalSecret(a.secret, a.credentialHash), true);
  assert.equal(verifyHu20TerminalSecret(b.secret, a.credentialHash), false);
  assert.equal(verifyHu20TerminalSecret("abc", a.credentialHash), false);
  assert.equal(verifyHu20TerminalSecret(a.secret, a.secret), false);
  assert.equal(validHu20TerminalId("23e5e35d-ac73-4de4-acd4-0198437e60bf"), true);
  assert.equal(validHu20TerminalId("not-an-id"), false);
});
test("HU20 API cannot submit payroll punches or expose templates in phase one", () => {
  const health = fs.readFileSync("app/api/staff-hu20/health/route.ts", "utf8");
  const register = fs.readFileSync("app/api/system/staff-hu20/terminals/route.ts", "utf8");
  assert.match(health, /punchEnabled: false/);
  assert.match(health, /authenticateHu20Terminal/);
  assert.doesNotMatch(health, /recordStaffPunch|bgm_staff_record_punch|bgm_staff_biometrics/);
  assert.match(register, /requireSuperAdmin/);
  assert.match(register, /writeStaffAudit/);
  assert.doesNotMatch(register, /encrypted_template|private-test.bgmcred/);
});
