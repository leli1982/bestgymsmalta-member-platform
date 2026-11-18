import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const admin = fs.readFileSync("app/api/system/staff-hu20/enrollments/route.ts", "utf8");
const terminal = fs.readFileSync("app/api/staff-hu20/enrollments/pending/route.ts", "utf8");
const sql = fs.readFileSync("supabase/migrations/20261112_150000_hu20_test_enrollment_requests.sql", "utf8");

test("HU20 TEST enrollment requests are Super Admin-only, time-limited and audited", () => {
  assert.match(admin, /isHu20TestRequestEnabled/);
  assert.match(admin, /requireSuperAdmin\(request\)/g);
  assert.match(admin, /authorizedOrigin\(request\)/);
  assert.match(admin, /ttlMillis = 10 \* 60 \* 1000/);
  assert.match(admin, /"staff\.hu20\.enrollment\.requested"/);
  assert.match(admin, /"staff\.hu20\.enrollment\.cancelled"/);
  assert.match(admin, /eq\("status", "pending"\)/);
  assert.match(admin, /eq\("active", true\)\.eq\("status", "enrolled"\)/);
  assert.doesNotMatch(admin, /encrypted_template|recordStaffPunch|bgm_staff_record_punch/);
});

test("HU20 terminal can only inspect own request without a fingerprint upload", () => {
  assert.match(terminal, /authenticateHu20Terminal\(request\)/);
  assert.match(terminal, /eq\("terminal_id", terminal\.id\)/);
  assert.match(terminal, /fingerprintCaptureEnabled: false/g);
  assert.doesNotMatch(terminal, /export async function POST|encrypted_template|recordStaffPunch/);
});

test("TEST queue has backend-only privileges, RLS and unique pending employee", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /TO service_role/);
  assert.match(sql, /WHERE status='pending'/);
  assert.doesNotMatch(sql, /create or replace function.*record_punch/);
});
