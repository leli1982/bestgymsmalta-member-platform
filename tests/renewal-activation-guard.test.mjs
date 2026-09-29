import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260925_111600_expired_renewal_activation_guard.sql", "utf8");
const enrollApi = readFileSync("app/api/system/members/enroll/route.ts", "utf8");

test("renewals reject a genuinely current membership, not an expired active-status row", () => {
  assert.match(migration, /status,membership_expiry into v_member_id,v_member_number,v_existing_photo_path,v_existing_status,v_existing_expiry/);
  assert.match(migration, /lower\(coalesce\(v_existing_status,''\)\)='active' and \(v_existing_expiry is null or v_existing_expiry >= v_today\) and v_participant.identity_match_state='expired_inactive'/);
  assert.doesNotMatch(migration, /if lower\(coalesce\(v_existing_status,''\)\)='active' and v_participant.identity_match_state='expired_inactive'/);
  assert.match(enrollApi, /existing matched member is active/);
});
